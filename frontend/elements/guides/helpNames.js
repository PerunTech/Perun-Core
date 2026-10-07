// The naming conventions help files are stored under, and the lookups that follow from them.
// Nothing here talks to the server: these are the rules for reading a stored name, and they are
// what lets a mixed listing be sorted into guides, manuals and figures without a round trip.

// Help content lives in SvFileStore rather than in labels: LABEL_DESCR is NVARCHAR(2000) of plain
// text, which is one or two paragraphs and no figures. File bytes go to a BLOB through SvLob, so a
// manual is bounded by the servlet container's multipart limit rather than by a column.
//
// FILE_TYPE is backed by the FILE_TYPES codelist, so these two values are added through
// Admin Console -> CodeList Editor with no code change and no migration.
export const HELP_DOC = 'HELP_DOC'
export const HELP_IMAGE = 'HELP_IMAGE'
// A manual uploaded as a finished PDF rather than written here. It is routed and listed exactly
// like a Markdown guide, and differs only in that the reader hands it over instead of rendering it.
export const HELP_PDF = 'HELP_PDF'

// <locale>_<slug>.md, e.g. en_US_searching-holdings.md, or the same with .pdf for an uploaded
// manual. Strict on purpose: a malformed name should surface as "not a help document" rather than
// silently defaulting to some locale.
const DOC_NAME = /^([a-z]{2}_[A-Z]{2})_(.+)\.(md|pdf)$/

// All HELP_IMAGE files share one flat namespace under the plugin row, so uploads are prefixed with
// the document stem they were added from to keep figure-1.png from colliding across documents.
const IMAGE_SEPARATOR = '__'

const MIME_BY_EXTENSION = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  md: 'text/markdown', pdf: 'application/pdf'
}

/* ------------------------------------------------------------------ names -- */

export const parseDocName = (fileName) => {
  const match = DOC_NAME.exec(fileName ?? '')
  if (!match) return null
  return { locale: match[1], slug: match[2], kind: match[3] === 'pdf' ? PDF_KIND : DOC_KIND }
}

/** What the reader does with a document: render it, or hand it over. */
export const DOC_KIND = 'markdown'
export const PDF_KIND = 'pdf'

export const buildDocName = (locale, slug) => `${locale}_${slug}.md`
export const buildPdfName = (locale, slug) => `${locale}_${slug}.pdf`

/** The extension a stored guide of either kind carries. */
export const kindExtension = (kind) => (kind === PDF_KIND ? 'pdf' : 'md')

/** The document stem an image upload is namespaced under, e.g. en_US_searching-holdings. */
export const docStem = (fileName) => (fileName ?? '').replace(/\.(md|pdf)$/i, '')

export const buildImageName = (stem, originalName) => {
  const safe = (originalName ?? '').replace(/[\\/]/g, '_').trim()
  return `${stem}${IMAGE_SEPARATOR}${safe}`
}

/** The filename an author writes in the Markdown, recovered from the stored name. */
export const displayImageName = (storedName) => {
  const at = (storedName ?? '').indexOf(IMAGE_SEPARATOR)
  return at === -1 ? storedName : storedName.slice(at + IMAGE_SEPARATOR.length)
}

/**
 * Which of the three help file types a listed row is.
 *
 * FILE_TYPE is what the store filters on and is the answer whenever it survives the trip. The name
 * is consulted only when it does not, because a mixed listing that misfiles a row drops a guide out
 * of the reader silently, and the naming rules here are ours and unambiguous: a guide or a manual
 * parses as <locale>_<slug> with a known extension, and a figure carries the `__` separator.
 * Anything matching neither belongs to some other feature on the same row and is not ours.
 */
export const helpFileType = (record) => {
  const declared = record?.fileType
  if (declared === HELP_DOC || declared === HELP_IMAGE || declared === HELP_PDF) return declared

  const parsed = parseDocName(record?.fileName)
  if (parsed) return parsed.kind === PDF_KIND ? HELP_PDF : HELP_DOC
  return String(record?.fileName ?? '').includes(IMAGE_SEPARATOR) ? HELP_IMAGE : null
}

export const mimeFromName = (fileName) => {
  const extension = (fileName ?? '').split('.').pop()?.toLowerCase()
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

// `%PDF`. The specification puts the marker at the start of the file, but readers accept it
// anywhere in the first kilobyte and files carrying a preamble exist, so the same latitude is
// given here rather than turning away a manual that every reader on the author's desk opens.
const PDF_MARKER = [0x25, 0x50, 0x44, 0x46]
const PDF_HEAD_BYTES = 1024

/**
 * Whether a picked file really is a PDF.
 *
 * Answered from the bytes rather than from `file.type`, because the type is the OS's guess from
 * the extension and is therefore exactly as trustworthy as the extension: renaming a spreadsheet
 * to .pdf satisfies both. `accept` on the input is weaker still, being a filter every file dialog
 * offers a way past. MyProfile checks avatar uploads against the photo signatures the same way.
 *
 * A file that cannot be read answers false, being no more uploadable than a wrong one.
 */
export const isPdfFile = async (file) => {
  if (!file) return false
  try {
    const head = new Uint8Array(await file.slice(0, PDF_HEAD_BYTES).arrayBuffer())
    return head.some((byte, at) => PDF_MARKER.every((marker, index) => head[at + index] === marker))
  } catch (err) {
    console.error('The chosen file could not be read', err)
    return false
  }
}

/** Whether a stored figure was uploaded from the document with this stem. */
export const isFigureOfDoc = (fileName, stem) =>
  String(fileName ?? '').startsWith(`${stem}${IMAGE_SEPARATOR}`)

/* ---------------------------------------------------------------- lookups -- */

/** Newest row per filename. Every save writes a new row, so history is free and the tail is stale. */
export const newestByName = (records) => {
  const newest = new Map()
  records.forEach(record => {
    const held = newest.get(record.fileName)
    const isNewer = !held
      || (record.fileDate ?? '') > (held.fileDate ?? '')
      || (record.fileDate === held.fileDate && Number(record.objectId) > Number(held.objectId))
    if (isNewer) newest.set(record.fileName, record)
  })
  return [...newest.values()]
}

/**
 * Finds the image a document meant by `name`. Tries the document's own namespaced upload first,
 * then the locale-stripped form, so a locale-neutral diagram is uploaded once and shared by every
 * translation while a localized screenshot stays specific to its language.
 */
export const resolveImageRecord = (images, stem, name) => {
  const slug = parseDocName(`${stem}.md`)?.slug
  const candidates = [
    `${stem}${IMAGE_SEPARATOR}${name}`,
    slug ? `${slug}${IMAGE_SEPARATOR}${name}` : null,
    name
  ].filter(Boolean)

  for (const candidate of candidates) {
    const found = images.find(image => image.fileName === candidate)
    if (found) return found
  }
  return null
}
