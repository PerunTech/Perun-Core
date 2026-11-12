import { useCallback, useEffect, useRef } from 'react';
import { LINE_ATTR } from '../../elements/guides/renderMarkdown';
import { projectScroll } from './utils';

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

  // Anchored at each block's source line: an image breaks proportional sync (one line, hundreds of
  // pixels of preview).
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

  // Each render replaces the preview's content, collapsing its height for an instant and clamping its
  // scroll to the top.
  useEffect(alignPreviewToEditor, [previewBody, alignPreviewToEditor]);

  // A figure has no height until it decodes, so re-align as each one lands.
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

  // Under the lock, so moving one pane doesn't bounce off the other.
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

  // Called from onMount, since there's nothing to subscribe to before.
  const watchEditor = useCallback((editor) => {
    subRef.current?.dispose();
    subRef.current = editor.onDidScrollChange(alignPreviewToEditor);
  }, [alignPreviewToEditor]);

  useEffect(() => () => subRef.current?.dispose(), []);

  return { previewRef, handlePreviewScroll, watchEditor, resetToTop };
};
