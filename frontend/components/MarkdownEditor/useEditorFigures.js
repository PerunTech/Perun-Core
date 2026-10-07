import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alertUserV2 } from '../../elements';
import { figureNames } from '../../elements/guides/figureRefs';
import { filesFrom, insertAtCursor, isImageFile, uniqueImageName } from './utils';

/**
 * Figures an author adds while writing, from the drop until the save.
 *
 * Inserting one only previews it: the bytes are held here behind an object URL and are uploaded on
 * save, and only for references the document still carries by then. That is what lets an insert be
 * undone without leaving an orphan in the file store, and it is why this owns the pending set
 * rather than handing each file straight to the caller.
 *
 * @param {object}   editorRef    the Monaco instance, for inserting the reference at the caret
 * @param {string}   previewBody  the debounced document, for counting what is still referenced
 * @param {Function} resolveImage names already taken by stored figures
 * @param {Function} uploadImage  the caller's writer, absent when the surface cannot store figures
 * @param {Function} onPasteText  a paste that carried no file, which is the caller's to handle
 */
export const useEditorFigures = ({
  editorRef, previewBody, resolveImage, uploadImage, fmt, onPasteText,
}) => {
  // Figures the author has inserted but not yet committed: { name: { file, url } }.
  const [pending, setPending] = useState({});
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef(null);
  // Mirrors `pending` for synchronous reads while naming a batch of dropped files.
  const pendingRef = useRef({});

  useEffect(() => { pendingRef.current = pending; }, [pending]);

  useEffect(() => () => {
    Object.values(pendingRef.current).forEach(entry => URL.revokeObjectURL(entry.url));
  }, []);

  // The badge counts the same set the save path uploads: figures the document still points at.
  // An image inserted and then deleted stays in `pending` so an undo can still resolve its
  // preview, but it is not pending anything any more and must not be advertised as such.
  const pendingNames = useMemo(() => {
    const referenced = new Set(figureNames(previewBody));
    return Object.keys(pending).filter((name) => referenced.has(name));
  }, [pending, previewBody]);

  const addImages = useCallback((files) => {
    if (!files.length) return;
    setUploadError('');

    const taken = { ...pendingRef.current };

    files.forEach(file => {
      const name = uniqueImageName(file.name, taken, candidate => Boolean(resolveImage?.(candidate)));
      taken[name] = { file, url: URL.createObjectURL(file) };
      insertAtCursor(editorRef.current, `\n![${file.name.replace(/\.[^.]+$/, '')}](${name})\n`);
    });

    pendingRef.current = taken;
    setPending(taken);
  }, [editorRef, resolveImage]);

  /**
   * The images out of a selection, having said out loud what it turned away.
   *
   * `accept` on the picker is a hint every file dialog offers a way past, and a drop or a paste
   * never consults it at all, so a file the editor cannot use was discarded in silence: nothing
   * appeared in the document and nothing said why.
   */
  const acceptedImages = useCallback((files) => {
    const rejected = files.filter(file => !isImageFile(file));
    if (rejected.length) {
      alertUserV2({
        type: 'info',
        title: fmt('perun.help_editor.error_not_image'),
        message: rejected.map(file => file.name).join(', '),
      });
    }
    return files.filter(isImageFile);
  }, [fmt]);

  const handlePaste = useCallback((event) => {
    const files = filesFrom(event.clipboardData);
    if (!files.length) {
      onPasteText?.();
      return;
    }
    // Without this Monaco pastes the filename as text alongside the upload.
    event.preventDefault();
    addImages(acceptedImages(files));
  }, [addImages, acceptedImages, onPasteText]);

  const handleDrop = useCallback((event) => {
    // Files rather than images, so a dropped PDF is answered rather than ignored. An empty list is
    // a drag that carried no file at all, such as a selection of text, and is left to the editor.
    const files = filesFrom(event.dataTransfer);
    setDragging(false);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    addImages(acceptedImages(files));
  }, [addImages, acceptedImages]);

  const handleDragOver = useCallback((event) => { event.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleFilePick = useCallback((event) => {
    addImages(acceptedImages([...(event.target.files ?? [])]));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addImages, acceptedImages]);

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  /**
   * Uploads the figures a saved document still references, and forgets the rest.
   *
   * @returns {Promise<boolean>} false when an upload failed, in which case the error is on screen
   *   and the caller must not go on to save: a document referencing a figure that never landed
   *   would render with a hole in it.
   */
  const commitFigures = useCallback(async ({ locale, slug, body }) => {
    // Only figures the document still points at are worth storing; the rest were inserted and
    // then removed, and are dropped with the object URLs that backed their preview.
    const referenced = new Set(figureNames(body));
    const entries = Object.entries(pendingRef.current);

    if (entries.length && uploadImage) {
      setUploading(true);
      setUploadError('');
      try {
        for (const [name, entry] of entries) {
          if (!referenced.has(name)) continue;
          await uploadImage(entry.file, { locale, slug, name });
        }
      } catch (error) {
        setUploadError(error?.message || fmt('perun.help_editor.error_upload'));
        setUploading(false);
        return false;
      }
      setUploading(false);
    }

    entries.forEach(([, entry]) => URL.revokeObjectURL(entry.url));
    pendingRef.current = {};
    setPending({});
    return true;
  }, [uploadImage, fmt]);

  return {
    pending, pendingNames, dragging, uploading, uploadError, fileInputRef,
    handlePaste, handleDrop, handleDragOver, handleDragLeave, handleFilePick,
    openPicker, commitFigures,
  };
};
