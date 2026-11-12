import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { createBlobCache } from '../../functions/fileStore';
import { uniqueImageName } from '../../functions/files';
import { imageReferences } from './richText';
import {
  deleteRichTextDocument, loadRichTextDocument, saveRichTextDocument, uploadRichTextImage,
} from './documentStore';

// <RichTextEditor {...document.editorProps} />, then document.save(). Images stay in the browser until
// the save, which uploads only those the document still shows.
export const useRichTextDocument = ({
  objectId, objectType, name, fileType, imageFileType, svSession: givenSession,
}) => {
  const storedSession = useSelector(state => state.security?.svSession);
  const svSession = givenSession ?? storedSession;
  const anchor = useMemo(
    () => ({ objectId, objectType, fileType, imageFileType }),
    [objectId, objectType, fileType, imageFileType]
  );

  const [value, setValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Image name to the URL it shows under: the stored ones, and those inserted since the last save.
  const [images, setImages] = useState({});
  const pending = useRef({});
  const valueRef = useRef(value);
  valueRef.current = value;

  const cache = useRef(null);
  const ownUrls = useRef(new Set());
  if (!cache.current) cache.current = createBlobCache();

  useEffect(() => () => {
    cache.current.revokeAll();
    ownUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    pending.current = {};
    setImages({});
    setValue('');
    setSavedValue('');
    setRecord(null);
    setError(null);
    // No session is a logout under way: asking anyway 401s into a second logout alert.
    if (!svSession || !objectId || !objectType || !name) return undefined;

    let cancelled = false;
    setLoading(true);
    loadRichTextDocument(svSession, anchor, name)
      .then(async (loaded) => {
        if (cancelled) return;
        setRecord(loaded.record);
        setValue(loaded.html);
        setSavedValue(loaded.html);
        setLoading(false);
        const shown = await Promise.all(loaded.images.map(async file => [file.image, await cache.current.get(svSession, file)]));
        if (!cancelled) setImages(current => ({ ...Object.fromEntries(shown), ...current }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [svSession, anchor, objectId, objectType, name]);

  const imagesRef = useRef(images);
  imagesRef.current = images;

  const resolveImage = useCallback((src) => images[src] ?? null, [images]);

  const uploadImage = useCallback(async (file) => {
    const image = uniqueImageName(file.name, imagesRef.current);
    const url = URL.createObjectURL(file);
    ownUrls.current.add(url);
    pending.current = { ...pending.current, [image]: file };
    imagesRef.current = { ...imagesRef.current, [image]: url };
    setImages(imagesRef.current);
    return image;
  }, []);

  // notes replaces the stored ones when given.
  const save = useCallback(async ({ notes } = {}) => {
    const html = valueRef.current;
    setSaving(true);
    setError(null);
    try {
      const shown = imageReferences(html);
      for (const [image, file] of Object.entries(pending.current)) {
        if (!shown.has(image)) continue;
        await uploadRichTextImage(svSession, anchor, { name, image, file });
        pending.current = Object.fromEntries(Object.entries(pending.current).filter(([held]) => held !== image));
      }
      const kept = notes ?? record?.notes ?? {};
      await saveRichTextDocument(svSession, anchor, { name, html, notes: kept });
      setRecord(current => ({ ...current, notes: kept }));
      setSavedValue(html);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [svSession, anchor, name, record]);

  const remove = useCallback(async () => {
    setSaving(true);
    try {
      await deleteRichTextDocument(svSession, anchor, name);
      pending.current = {};
      setRecord(null);
      setValue('');
      setSavedValue('');
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [svSession, anchor, name]);

  return {
    value,
    setValue,
    record,
    exists: Boolean(record),
    dirty: value !== savedValue,
    loading,
    saving,
    error,
    save,
    remove,
    resolveImage,
    uploadImage,
    editorProps: { value, onChange: setValue, resolveImage, uploadImage, readOnly: loading || saving },
  };
};

export default useRichTextDocument;
