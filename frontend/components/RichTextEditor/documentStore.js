import {
  ALL_FILE_TYPES, deleteFile, fetchFileText, listFiles, newestByName, uploadFile,
} from '../../functions/fileStore';

/*
 * Rich text documents as files on an object, the way the user guides are kept: `<name>.html`,
 * with its images beside it as `<name>~<image>`. Every save writes a new row, so the newest row
 * of a name is the document and the older ones are its history.
 *
 * `anchor` is the object the documents belong to: { objectId, objectType } with objectType the
 * svarog table name, and optionally its own file types in place of the two below.
 */

// FILE_TYPE is backed by the FILE_TYPES codelist; these are added there, as HELP_DOC was.
export const RICH_TEXT_DOC = 'RICH_TEXT_DOC';
export const RICH_TEXT_IMAGE = 'RICH_TEXT_IMAGE';

const EXTENSION = '.html';
// Not the guides' `__`: helpFileType reads any `__` name as a guide figure when its type is not a help type.
const IMAGE_SEPARATOR = '~';

export const documentFileName = (name) => `${name}${EXTENSION}`;
const imagePrefix = (name) => `${name}${IMAGE_SEPARATOR}`;

const checkName = (name) => {
  if (!name || /[\\/~]/.test(name) || name.includes('__')) {
    throw new Error(`"${name}" cannot name a rich text document: it needs no slashes, no "~" and no "__"`);
  }
};

const typesOf = ({ fileType = RICH_TEXT_DOC, imageFileType = RICH_TEXT_IMAGE }) => ({ fileType, imageFileType });

// The type decides wherever the row still carries one; the name only when it does not.
const isDocument = (record, anchor) => (record.fileType
  ? record.fileType === typesOf(anchor).fileType
  : record.fileName.endsWith(EXTENSION) && !record.fileName.includes(IMAGE_SEPARATOR));

const isImageOf = (record, anchor, name) => record.fileName.startsWith(imagePrefix(name))
  && (!record.fileType || record.fileType === typesOf(anchor).imageFileType);

const everyFile = (svSession, { objectId, objectType }) =>
  listFiles(svSession, { objectId, objectType, fileType: ALL_FILE_TYPES });

const escapeHtml = (text) => String(text ?? '').replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`);

// A whole page, so the file reads right in a browser when it is downloaded on its own.
const asPage = (html, title) => '<!DOCTYPE html>\n<html><head><meta charset="utf-8">'
  + `<title>${escapeHtml(title)}</title></head><body>\n${html}\n</body></html>\n`;

const bodyOf = (text) => (/<body[\s>]/i.test(text)
  ? new window.DOMParser().parseFromString(text, 'text/html').body.innerHTML.trim()
  : text);

/** The documents on an object, newest version of each, with `name` beside the file record. */
export const listRichTextDocuments = async (svSession, anchor) =>
  newestByName(await everyFile(svSession, anchor))
    .filter(record => isDocument(record, anchor))
    .map(record => ({ ...record, name: record.fileName.slice(0, -EXTENSION.length) }));

/**
 * One document: its newest record (null for one never saved), its HTML, and the records of its
 * images with `image`, the name its HTML refers to them by.
 */
export const loadRichTextDocument = async (svSession, anchor, name) => {
  checkName(name);
  const files = newestByName(await everyFile(svSession, anchor));
  const record = files.find(file => isDocument(file, anchor) && file.fileName === documentFileName(name)) ?? null;
  const images = files
    .filter(file => isImageOf(file, anchor, name))
    .map(file => ({ ...file, image: file.fileName.slice(imagePrefix(name).length) }));
  const html = record ? bodyOf(await fetchFileText(svSession, record)) : '';
  return { record, html, images };
};

export const saveRichTextDocument = (svSession, anchor, { name, html, notes }) => {
  checkName(name);
  return uploadFile(svSession, {
    objectId: anchor.objectId,
    objectType: anchor.objectType,
    fileType: typesOf(anchor).fileType,
    file: new Blob([asPage(html, notes?.title ?? name)], { type: 'text/html' }),
    fileName: documentFileName(name),
    notes,
  });
};

export const uploadRichTextImage = (svSession, anchor, { name, image, file }) => {
  checkName(name);
  return uploadFile(svSession, {
    objectId: anchor.objectId,
    objectType: anchor.objectType,
    fileType: typesOf(anchor).imageFileType,
    file,
    fileName: `${imagePrefix(name)}${image}`,
    notes: { document: name },
  });
};

/**
 * Removes a document completely: every version of it, and its images. Deleting only the newest
 * row would bring the previous version back.
 *
 * @returns {Promise<number>} the files removed
 */
export const deleteRichTextDocument = async (svSession, anchor, name) => {
  checkName(name);
  const doomed = (await everyFile(svSession, anchor)).filter(record =>
    (isDocument(record, anchor) && record.fileName === documentFileName(name)) || isImageOf(record, anchor, name));
  for (const record of doomed) {
    await deleteFile(svSession, record.objectId);
  }
  return doomed.length;
};
