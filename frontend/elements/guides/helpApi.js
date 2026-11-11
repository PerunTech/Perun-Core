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

// The file endpoints resolve this through SvCore.getTypeIdByName, which expects the svarog table
// name and not the short context name. Sending 'PERUN_PLUGIN' makes getTypeIdByName fail, and the
// getObjectById that follows throws, which the endpoint reports as a 500. Derived from the table
// constant so the two cannot drift apart again.
const HELP_ANCHOR_TYPE = PLUGIN_TABLE

/* ------------------------------------------------------------------- rest -- */

const withDocName = (record) => {
  const parsed = parseDocName(record.fileName)
  return { ...record, locale: parsed?.locale ?? null, slug: parsed?.slug ?? null, kind: parsed?.kind ?? null }
}

/** Lists one file type under an anchor object. One call returns the whole routing index. */
export const listHelpFiles = async (svSession, objectId, fileType, objectType = HELP_ANCHOR_TYPE) =>
  (await listFiles(svSession, { objectId, objectType, fileType })).map(withDocName)

export const fetchHelpText = fetchFileText

/** Uploads one file to the plugin row unless another object is named. */
export const uploadHelpFile = (svSession, { objectType = HELP_ANCHOR_TYPE, ...file }) =>
  uploadFile(svSession, { objectType, ...file })

/** Saves Markdown text as a document, deriving the filename from its locale and slug. */
export const saveHelpDoc = (svSession, { objectId, locale, slug, markdown, notes }) => {
  const fileName = buildDocName(locale, slug)
  const file = new Blob([markdown], { type: 'text/markdown' })
  return uploadHelpFile(svSession, { objectId, fileType: HELP_DOC, file, fileName, notes })
}

/**
 * Stores an uploaded PDF as a manual.
 *
 * Named and noted exactly like a Markdown guide, because that is what makes it routable: the notes
 * carry the route the reader matches on, so guidesForRoute sorts the two kinds into one list
 * without knowing there are two.
 */
export const savePdfManual = (svSession, { objectId, locale, slug, file, notes }) =>
  uploadHelpFile(svSession, {
    objectId, fileType: HELP_PDF, file, fileName: buildPdfName(locale, slug), notes,
  })

/* --------------------------------------------------------------- deleting -- */

/**
 * Removes a document completely: every stored version of it, and the figures uploaded from it.
 *
 * Deleting only the newest row would appear to work and then silently resurrect the guide, because
 * newestByName would fall back to the previous version. Figures are matched on the document's own
 * `<locale>_<slug>__` prefix only, so a locale-neutral image shared with another translation is
 * left alone.
 */
export const deleteHelpDoc = async (svSession, { objectId, fileName, kind = DOC_KIND }) => {
  const stem = docStem(fileName)

  const files = await listHelpFiles(svSession, objectId, ALL_FILE_TYPES)
  const versions = files.filter(record => record.fileName === fileName)

  // An uploaded manual carries its figures inside itself, so there is no figure namespace to sweep.
  const figures = kind === PDF_KIND ? [] : files.filter(record =>
    helpFileType(record) === HELP_IMAGE && isFigureOfDoc(record.fileName, stem))

  for (const record of [...versions, ...figures]) {
    await deleteFile(svSession, record.objectId)
  }

  return { versions: versions.length, figures: figures.length }
}
