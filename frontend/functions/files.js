// file.type is often empty (a drag out of an archive, an unknown extension), so the name answers then.
// No signature check: the editors take anything the browser renders.
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

export const isImageFile = (file) =>
  Boolean(file) && (file.type ? file.type.startsWith('image/') : IMAGE_NAME.test(file.name ?? ''));

// Unfiltered, so the caller reports what it can't use. An image copied out of another page arrives in
// items, with files empty.
export const filesFrom = (dataTransfer) => {
  const files = [...(dataTransfer?.files ?? [])];
  if (files.length) return files;
  return [...(dataTransfer?.items ?? [])]
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);
};

// What a Markdown destination can't carry ("photo (1).png") or breaks once the archive is extracted
// (# and ?). The rest is kept, so a Cyrillic name keeps its letters.
const REFERENCE_UNSAFE = /[\s()<>[\]"'\\/#?]+/g;

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
