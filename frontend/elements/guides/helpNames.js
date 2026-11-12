// Help is stored as files, not labels (LABEL_DESCR is 2000 characters of plain text). The FILE_TYPE
// values are FILE_TYPES codelist entries.
export { mimeFromName, newestByName } from '../../functions/fileStore'

export const HELP_DOC = 'HELP_DOC'
export const HELP_IMAGE = 'HELP_IMAGE'
// A finished PDF, routed like a guide but handed over instead of rendered.
export const HELP_PDF = 'HELP_PDF'

// Strict, so a malformed name is not a guide rather than a guess at a locale.
const DOC_NAME = /^([a-z]{2}_[A-Z]{2})_(.+)\.(md|pdf)$/

// Figures share one namespace per plugin row, so they carry their document's stem.
const IMAGE_SEPARATOR = '__'

export const parseDocName = (fileName) => {
  const match = DOC_NAME.exec(fileName ?? '')
  if (!match) return null
  return { locale: match[1], slug: match[2], kind: match[3] === 'pdf' ? PDF_KIND : DOC_KIND }
}

export const DOC_KIND = 'markdown'
export const PDF_KIND = 'pdf'

export const buildDocName = (locale, slug) => `${locale}_${slug}.md`
export const buildPdfName = (locale, slug) => `${locale}_${slug}.pdf`

export const kindExtension = (kind) => (kind === PDF_KIND ? 'pdf' : 'md')

export const docStem = (fileName) => (fileName ?? '').replace(/\.(md|pdf)$/i, '')

export const buildImageName = (stem, originalName) => {
  const safe = (originalName ?? '').replace(/[\\/]/g, '_').trim()
  return `${stem}${IMAGE_SEPARATOR}${safe}`
}

export const displayImageName = (storedName) => {
  const at = (storedName ?? '').indexOf(IMAGE_SEPARATOR)
  return at === -1 ? storedName : storedName.slice(at + IMAGE_SEPARATOR.length)
}

// FILE_TYPE when it survives the trip, else the naming rules, so a misfiled row can't silently drop a
// guide. Anything matching neither belongs to another feature.
export const helpFileType = (record) => {
  const declared = record?.fileType
  if (declared === HELP_DOC || declared === HELP_IMAGE || declared === HELP_PDF) return declared

  const parsed = parseDocName(record?.fileName)
  if (parsed) return parsed.kind === PDF_KIND ? HELP_PDF : HELP_DOC
  return String(record?.fileName ?? '').includes(IMAGE_SEPARATOR) ? HELP_IMAGE : null
}

// Readers accept the marker anywhere in the first kilobyte, and files with a preamble exist.
const PDF_MARKER = [0x25, 0x50, 0x44, 0x46]
const PDF_HEAD_BYTES = 1024

// Read from the bytes: file.type is guessed from the extension, so a renamed spreadsheet passes it.
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

export const isFigureOfDoc = (fileName, stem) =>
  String(fileName ?? '').startsWith(`${stem}${IMAGE_SEPARATOR}`)

// The document's own upload first, then the locale-stripped name, so one diagram serves every
// translation while a screenshot stays specific to its language.
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
