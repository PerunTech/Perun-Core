import {
  DOC_KIND, HELP_DOC, HELP_IMAGE, HELP_PDF, PDF_KIND,
  buildDocName, buildPdfName, docStem, helpFileType, isFigureOfDoc, parseDocName
} from './helpNames'
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

export const saveHelpDoc = (svSession, { objectId, locale, slug, markdown, notes }) => {
  const fileName = buildDocName(locale, slug)
  const file = new Blob([markdown], { type: 'text/markdown' })
  return uploadHelpFile(svSession, { objectId, fileType: HELP_DOC, file, fileName, notes })
}

// Named and noted like a Markdown guide, so it is routed along with them.
export const savePdfManual = (svSession, { objectId, locale, slug, file, notes }) =>
  uploadHelpFile(svSession, {
    objectId, fileType: HELP_PDF, file, fileName: buildPdfName(locale, slug), notes,
  })

// Every version goes, or newestByName would bring the previous one back. Figures match only this
// document's own prefix, so a locale-neutral one stays.
export const deleteHelpDoc = async (svSession, { objectId, fileName, kind = DOC_KIND }) => {
  const stem = docStem(fileName)

  const files = await listHelpFiles(svSession, objectId, ALL_FILE_TYPES)
  const versions = files.filter(record => record.fileName === fileName)

  // A PDF carries its own figures.
  const figures = kind === PDF_KIND ? [] : files.filter(record =>
    helpFileType(record) === HELP_IMAGE && isFigureOfDoc(record.fileName, stem))

  for (const record of [...versions, ...figures]) {
    await deleteFile(svSession, record.objectId)
  }

  return { versions: versions.length, figures: figures.length }
}
