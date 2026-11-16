import {
  DOC_KIND, HELP_DOC, HELP_IMAGE, HELP_PDF, HTML_KIND, PDF_KIND,
  buildDocName, buildPdfName, docStem, helpFileType, isFigureOfDoc, parseDocName
} from './helpNames'
import { guideFormat } from './guideFormat'
import { ALL_FILE_TYPES, deleteFile, fetchFileText, listFiles, uploadFile } from '../../functions/fileStore'

export {
  ALL_FILE_TYPES, createBlobCache, readItems, readObjectId, readValue, requireResponse
} from '../../functions/fileStore'

// Documents hang off the owning module's plugin row; perun-core's own row holds the general ones.
export const PLUGIN_TABLE = 'SVAROG_PERUN_PLUGIN'

// The file endpoints want the svarog table name; 'PERUN_PLUGIN' makes getTypeIdByName fail with a 500.
const HELP_ANCHOR_TYPE = PLUGIN_TABLE

const withDocName = (record) => {
  const parsed = parseDocName(record.fileName)
  return { ...record, locale: parsed?.locale ?? null, slug: parsed?.slug ?? null, kind: parsed?.kind ?? null }
}

export const listHelpFiles = async (svSession, objectId, fileType, objectType = HELP_ANCHOR_TYPE) =>
  (await listFiles(svSession, { objectId, objectType, fileType })).map(withDocName)

export const fetchHelpText = fetchFileText

export const uploadHelpFile = (svSession, { objectType = HELP_ANCHOR_TYPE, ...file }) =>
  uploadFile(svSession, { objectType, ...file })

const OTHER_KIND = { [DOC_KIND]: HTML_KIND, [HTML_KIND]: DOC_KIND }

// HELP_DOC for either kind: the extension tells a rich text guide from a Markdown one. A guide is one
// file per name, so the other kind's file goes; the figures stay, being named for the shared stem.
export const saveHelpDoc = async (svSession, { objectId, locale, slug, kind = DOC_KIND, text, notes }) => {
  const fileName = buildDocName(locale, slug, kind)
  const file = new Blob([text], { type: guideFormat(kind).mime })
  const saved = await uploadHelpFile(svSession, { objectId, fileType: HELP_DOC, file, fileName, notes })

  const other = OTHER_KIND[kind]
  if (other) {
    await deleteHelpDoc(svSession, { objectId, fileName: buildDocName(locale, slug, other), kind: other, keepFigures: true })
  }
  return saved
}

// Named and noted like a Markdown guide, so it is routed along with them.
export const savePdfManual = (svSession, { objectId, locale, slug, file, notes }) =>
  uploadHelpFile(svSession, {
    objectId, fileType: HELP_PDF, file, fileName: buildPdfName(locale, slug), notes,
  })

// Every version goes, or newestByName would bring the previous one back. Figures match only this
// document's own prefix, so a locale-neutral one stays. keepFigures is for a guide that lives on in
// the other kind, under the same stem.
export const deleteHelpDoc = async (svSession, { objectId, fileName, kind = DOC_KIND, keepFigures = false }) => {
  const stem = docStem(fileName)

  const files = await listHelpFiles(svSession, objectId, ALL_FILE_TYPES)
  // By type too, so a rich text document of the same name (documentStore) is left alone.
  const versions = files.filter(record =>
    record.fileName === fileName && [HELP_DOC, HELP_PDF].includes(helpFileType(record)))

  // A PDF carries its own figures.
  const figures = kind === PDF_KIND || keepFigures ? [] : files.filter(record =>
    helpFileType(record) === HELP_IMAGE && isFigureOfDoc(record.fileName, stem))

  for (const record of [...versions, ...figures]) {
    await deleteFile(svSession, record.objectId)
  }

  return { versions: versions.length, figures: figures.length }
}
