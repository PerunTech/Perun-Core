import { useCallback, useEffect, useRef } from 'react';
import { LINE_ATTR } from '../../elements/guides/renderMarkdown';
import { projectScroll } from './utils';

/**
 * Keeps the preview pane in step with the source pane, in both directions.
 *
 * Its own hook because none of it is about Markdown or about editing: it is a mapping between two
 * scrolling boxes, and the only thing it needs to know about the document is that the renderer
 * stamps each block with the source line it came from.
 *
 * @param {object} editorRef  the Monaco editor instance, once mounted
 * @param {string} previewBody the rendered document, for realigning after each render
 * @returns {{previewRef: object, handlePreviewScroll: Function, watchEditor: Function}}
 *   `previewRef` goes on the preview pane, `handlePreviewScroll` on its onScroll, and
 *   `watchEditor` is called with the editor once it exists.
 */
export const useScrollSync = (editorRef, previewBody) => {
  const previewRef = useRef(null);
  // Whichever pane the user is actually scrolling holds the lock, so the scroll we induce on the
  // other one does not bounce straight back and fight it.
  const lockRef = useRef(null);
  const subRef = useRef(null);

  const withScrollLock = useCallback((side, apply) => {
    if (lockRef.current && lockRef.current !== side) return;
    lockRef.current = side;
    apply();
    window.requestAnimationFrame(() => { lockRef.current = null; });
  }, []);

  /**
   * Pairs each rendered block's top with the top of the source line it came from.
   *
   * Sync used to be proportional, holding both panes at the same fraction of their scroll range.
   * That assumes source and rendered content have the same density, which an image breaks harder
   * than anything else: one line of Markdown becomes several hundred pixels of preview. Anchors
   * make the mapping piecewise linear between real landmarks instead, so a figure moves the two
   * panes together rather than pushing them apart.
   */
  const anchorPairs = useCallback(() => {
    const preview = previewRef.current;
    const editor = editorRef.current;
    if (!preview || !editor) return [];

    // getBoundingClientRect is viewport relative; this rebases it onto the scrolled content.
    const base = preview.getBoundingClientRect().top - preview.scrollTop;
    const pairs = [{ editorTop: 0, previewTop: 0 }];

    preview.querySelectorAll(`[${LINE_ATTR}]`).forEach((element) => {
      const line = Number(element.getAttribute(LINE_ATTR));
      if (!line) return;
      pairs.push({
        editorTop: editor.getTopForLineNumber(line),
        previewTop: element.getBoundingClientRect().top - base,
      });
    });

    pairs.push({ editorTop: editor.getScrollHeight(), previewTop: preview.scrollHeight });
    return pairs;
  }, [editorRef]);

  const alignPreviewToEditor = useCallback(() => {
    const preview = previewRef.current;
    const editor = editorRef.current;
    if (!preview || !editor) return;

    withScrollLock('editor', () => {
      const target = projectScroll(anchorPairs(), editor.getScrollTop(), 'editorTop', 'previewTop');
      const limit = Math.max(preview.scrollHeight - preview.clientHeight, 0);
      preview.scrollTop = Math.min(Math.max(target, 0), limit);
    });
  }, [editorRef, withScrollLock, anchorPairs]);

  // Each debounced render replaces the preview's content wholesale, which collapses its height to
  // zero for an instant and lets the browser clamp the scroll position to the top. Without this the
  // preview snaps back to the start every 200ms while the author is typing further down.
  useEffect(alignPreviewToEditor, [previewBody, alignPreviewToEditor]);

  // A figure contributes no height until it decodes, so anchors measured at render time put every
  // block after it too high. Re-aligning as each one lands is what keeps an illustrated document in
  // step instead of drifting further the more images it carries.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return undefined;

    const loading = [...preview.querySelectorAll('img')].filter((img) => !img.complete);
    if (!loading.length) return undefined;

    const settle = () => alignPreviewToEditor();
    loading.forEach((img) => {
      img.addEventListener('load', settle);
      img.addEventListener('error', settle);
    });
    return () => loading.forEach((img) => {
      img.removeEventListener('load', settle);
      img.removeEventListener('error', settle);
    });
  }, [previewBody, alignPreviewToEditor]);

  const handlePreviewScroll = useCallback(() => {
    const preview = previewRef.current;
    const editor = editorRef.current;
    if (!preview || !editor) return;

    withScrollLock('preview', () => {
      const target = projectScroll(anchorPairs(), preview.scrollTop, 'previewTop', 'editorTop');
      editor.setScrollTop(Math.max(target, 0));
    });
  }, [editorRef, withScrollLock, anchorPairs]);

  /**
   * Sends both panes, and the caret, back to the top.
   *
   * Held under the lock like any other induced scroll, so moving one pane does not bounce off the
   * other on the way.
   */
  const resetToTop = useCallback(() => {
    withScrollLock('editor', () => {
      const editor = editorRef.current;
      // setPosition moves the caret without revealing it, so the explicit scroll below is what
      // actually decides where the view lands.
      editor?.setPosition({ lineNumber: 1, column: 1 });
      editor?.setScrollTop(0);
      if (previewRef.current) previewRef.current.scrollTop = 0;
    });
  }, [editorRef, withScrollLock]);

  /**
   * Follows the editor's own scrolling. Called from onMount, since there is nothing to subscribe
   * to before then, and re-subscribed if the editor is ever remounted.
   */
  const watchEditor = useCallback((editor) => {
    subRef.current?.dispose();
    subRef.current = editor.onDidScrollChange(alignPreviewToEditor);
  }, [alignPreviewToEditor]);

  useEffect(() => () => subRef.current?.dispose(), []);

  return { previewRef, handlePreviewScroll, watchEditor, resetToTop };
};
