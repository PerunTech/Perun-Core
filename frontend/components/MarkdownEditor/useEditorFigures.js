import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alertUserV2 } from '../../elements';
import { figureNames } from '../../elements/guides/figureRefs';
import { filesFrom, isImageFile, uniqueImageName } from '../../functions/files';
import { insertAtCursor } from './utils';

// Inserted figures are held behind object URLs and uploaded on save only if still referenced, so an
// undone insert leaves no orphan in the file store.
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

  // What the save would upload: an image inserted then deleted stays in pending for undo, uncounted.
  const pendingNames = useMemo(() => {
    const referenced = new Set(figureNames(previewBody));
    return Object.keys(pending).filter((name) => referenced.has(name));
  }, [pending, previewBody]);

  const hold = useCallback((files) => {
    setUploadError('');
    const taken = { ...pendingRef.current };
    const names = files.map((file) => {
      const name = uniqueImageName(file.name, taken, candidate => Boolean(resolveImage?.(candidate)));
      taken[name] = { file, url: URL.createObjectURL(file) };
      return name;
    });
    pendingRef.current = taken;
    setPending(taken);
    return names;
  }, [resolveImage]);

  const addImages = useCallback((files) => {
    if (!files.length) return;
    hold(files).forEach((name, index) => {
      insertAtCursor(editorRef.current, `\n![${files[index].name.replace(/\.[^.]+$/, '')}](${name})\n`);
    });
  }, [editorRef, hold]);

  // The rich text editor's uploadImage: the image is held like any other and named for the document.
  const holdImage = useCallback(async (file) => hold([file])[0], [hold]);

  // A file the editor can't use is reported: accept is only a hint, and drops and pastes skip it.
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
    // Files, not images, so a dropped PDF is answered; an empty list is a text drag, left to the editor.
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

  // false when an upload failed (its error is on screen): the caller must not save a document with a
  // missing figure.
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
    openPicker, holdImage, commitFigures,
  };
};
