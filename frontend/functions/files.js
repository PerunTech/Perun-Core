// The browser's own type is the answer when it has one, but it comes back empty often enough (a
// drag out of an archive, an extension the OS does not recognise) that the name has to be able to
// answer for it. No signature check, unlike the manual upload: the editors take whatever the
// browser will render, which spans a text format and several whose marker sits at its own offset.
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Whether an editor is willing to store a file as an image. */
export const isImageFile = (file) =>
  Boolean(file) && (file.type ? file.type.startsWith('image/') : IMAGE_NAME.test(file.name ?? ''));

/**
 * Every file a drop or paste event carries, by whichever of the two routes it exposes them.
 *
 * Unfiltered on purpose. A file the editor cannot use is reported rather than discarded in
 * silence, so the caller is handed the whole selection and has to decide out loud. Items are the
 * clipboard's usual shape for an image copied out of another page, where `files` is empty.
 */
export const filesFrom = (dataTransfer) => {
  const files = [...(dataTransfer?.files ?? [])];
  if (files.length) return files;
  return [...(dataTransfer?.items ?? [])]
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);
};

/**
 * A figure name not already used by this document, so two files both called screenshot.png can be
 * inserted without one shadowing the other.
 *
 * @param {string} fileName    the dropped file's own name
 * @param {object} taken       names already pending in this session
 * @param {(name: string) => boolean} isStored  whether the name already exists server side
 */
// Markdown gives a link destination no way to carry a space or a parenthesis, so a figure named
// the way a camera or a screenshot tool leaves it, "photo (1).png", would be inserted as a
// reference marked cannot parse: it renders as literal text, and figureNames does not see it
// either, so the file is never uploaded on save. `#` and `?` parse but break the reference once
// the archive is extracted and opened as files.
//
// Only those characters are replaced. Everything else is left alone, so a name written in
// Cyrillic keeps its letters rather than becoming a row of dashes.
const REFERENCE_UNSAFE = /[\s()<>[\]"'\\/#?]+/g;

/** The figure name as it can be written into a document and stored beside it. */
const referenceSafe = (fileName) => {
  const cleaned = String(fileName || 'image').trim().replace(REFERENCE_UNSAFE, '-');
  const dot = cleaned.lastIndexOf('.');
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return `${stem || 'image'}${dot > 0 ? cleaned.slice(dot) : ''}`;
};

export const uniqueImageName = (fileName, taken = {}, isStored) => {
  const safe = referenceSafe(fileName);
  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const extension = dot > 0 ? safe.slice(dot) : '';

  let candidate = safe;
  let suffix = 2;
  while (taken[candidate] || isStored?.(candidate)) {
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }
  return candidate;
};
