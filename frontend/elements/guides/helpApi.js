import axios from 'axios'
import {
  DOC_KIND, HELP_DOC, HELP_IMAGE, HELP_PDF, PDF_KIND,
  buildDocName, buildPdfName, docStem, helpFileType, isFigureOfDoc, mimeFromName, parseDocName
} from './helpNames'
import { decodeNotes, encodeNotes } from './helpNotes'

// getUploadedFiles reads "0" as "no filter" and answers with every file on the object, which is the
// convention the attachment menus already use. One listing per plugin row therefore covers guides,
// manuals and figures together, where asking per type costs a round trip each.
export const ALL_FILE_TYPES = '0'

// Documents hang off the owning module's plugin row; perun-core's own row holds the general ones.
export const PLUGIN_TABLE = 'SVAROG_PERUN_PLUGIN'

// The file endpoints resolve this through SvCore.getTypeIdByName, which expects the svarog table
// name and not the short context name. Sending 'PERUN_PLUGIN' makes getTypeIdByName fail, and the
// getObjectById that follows throws, which the endpoint reports as a 500. Derived from the table
// constant so the two cannot drift apart again.
const HELP_ANCHOR_TYPE = PLUGIN_TABLE

/* ------------------------------------------------------------------- rest -- */

// getUploadedFiles answers with Jsonable.toSimpleJson() over a DbDataArray. Observed shape is
// { indexField, filter, items: [ { object_id, FILE_NAME, ... } ] }: repo columns and field values
// sit flat on the item, there is no nested values object. An empty result skips toSimpleJson
// entirely and sends data: {}. The readers below still tolerate a bare array and a nested values
// object, so a serialization change degrades to an empty list instead of a crash.
/**
 * The response, or a throw when there is none.
 *
 * The global response interceptor in client.js handles 401, 302, 502 and 503 itself and then falls
 * out of its switch returning nothing, which resolves the promise with undefined instead of
 * rejecting it. Every reader below would otherwise parse an expired session as a successful empty
 * answer, and the index would cache "this module has no guides" for the life of the tab.
 *
 * A genuinely empty result is distinguishable: the backend skips toSimpleJson and sends data: {},
 * so only a missing response object is treated as a failure here.
 */
export const requireResponse = (response) => {
  if (!response) throw new Error('The request did not complete')
  return response
}

export const readItems = (payload) => {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

export const readValue = (item, key) => item?.values?.[key] ?? item?.[key] ?? null

export const readObjectId = (item) =>
  item?.object_id ?? item?.objectId ?? item?.OBJECT_ID ?? readValue(item, 'OBJECT_ID')

const toRecord = (item) => {
  const fileName = readValue(item, 'FILE_NAME')
  const parsed = parseDocName(fileName)
  return {
    objectId: readObjectId(item),
    fileName,
    fileType: readValue(item, 'FILE_TYPE'),
    fileSize: readValue(item, 'FILE_SIZE'),
    fileDate: readValue(item, 'FILE_DATE'),
    contentType: readValue(item, 'CONTENT_TYPE') || mimeFromName(fileName),
    notes: decodeNotes(readValue(item, 'FILE_NOTES')),
    locale: parsed?.locale ?? null,
    slug: parsed?.slug ?? null,
    kind: parsed?.kind ?? null
  }
}

/** Lists one file type under an anchor object. One call returns the whole routing index. */
export const listHelpFiles = async (svSession, objectId, fileType, objectType = HELP_ANCHOR_TYPE) => {
  const url = `${window.server}/ReactElements/getUploadedFiles/sid/${svSession}`
    + `/object-id/${objectId}/object-type/${objectType}/file-type/${fileType}`
  const response = requireResponse(await axios.get(url))
  return readItems(response?.data).map(toRecord).filter(record => record.objectId && record.fileName)
}

/**
 * Fetches file bytes as a Blob. CONTENT_TYPE is null for every row written by the current upload
 * path, and downloadFile answers application/octet-stream regardless, so the type is taken from the
 * record and only then from the response.
 */
const fetchHelpBlob = async (svSession, record) => {
  const url = `${window.server}/ReactElements/downloadFile/sid/${svSession}`
    + `/object-id/${record.objectId}/file-name/${encodeURIComponent(record.fileName)}`
  const response = requireResponse(await axios.get(url, { responseType: 'blob' }))
  return new Blob([response?.data], { type: record.contentType || mimeFromName(record.fileName) })
}

export const fetchHelpText = async (svSession, record) => {
  const blob = await fetchHelpBlob(svSession, record)
  return blob.text()
}

/**
 * Uploads one file. The single-file endpoint is the only one that accepts a note, so document saves
 * always go through here; the bulk endpoint hardcodes it to null.
 */
export const uploadHelpFile = async (svSession, { objectId, objectType = HELP_ANCHOR_TYPE, fileType, file, fileName, notes }) => {
  const payload = new FormData()
  payload.append('file', file, fileName ?? file.name)

  const url = `${window.server}/ReactElements/uploadFile/sid/${svSession}`
    + `/object-id/${objectId}/object-type/${objectType}/file-type/${fileType}`
    + `/note/${encodeNotes(notes)}`

  const response = requireResponse(await axios.post(url, payload, { headers: { 'Content-Type': 'multipart/form-data' } }))
  return response?.data
}

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

// svCONST.OBJECT_TYPE_FILE. The delete endpoint takes the type as a number, and the file rows
// getUploadedFiles returns carry the same value in object_type.
const OBJECT_TYPE_FILE = 2

/**
 * Invalidates one file object and the link that attached it.
 *
 * deleteObject reads its payload from the *key* of a form-urlencoded body, which is why the JSON
 * goes through encodeURIComponent and there is no value half. deleteLinks is on so the row in
 * SVAROG_LINK goes with the file rather than being left dangling at the plugin.
 */
const deleteHelpFile = async (svSession, objectId) => {
  const payload = JSON.stringify({ OBJECT_ID: Number(objectId), OBJECT_TYPE: OBJECT_TYPE_FILE })
  const url = `${window.server}/ReactElements/deleteObject/${svSession}/false/true`
  const response = requireResponse(await axios.post(url, encodeURIComponent(payload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }))
  if (String(response?.data?.type).toUpperCase() === 'ERROR') throw new Error(response.data.message)
  return response?.data
}

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
    await deleteHelpFile(svSession, record.objectId)
  }

  return { versions: versions.length, figures: figures.length }
}

/**
 * Object URLs held per file object id. createObjectURL keeps the bytes alive until revoked, so an
 * illustrated document opened repeatedly would pin every figure for the life of the tab.
 */
export const createBlobCache = () => {
  const urls = new Map()

  return {
    async get(svSession, record) {
      if (!record?.objectId) return null
      if (urls.has(record.objectId)) return urls.get(record.objectId)
      const blob = await fetchHelpBlob(svSession, record)
      const url = URL.createObjectURL(blob)
      urls.set(record.objectId, url)
      return url
    },
    peek(objectId) {
      return urls.get(objectId) ?? null
    },
    revokeAll() {
      urls.forEach(url => URL.revokeObjectURL(url))
      urls.clear()
    }
  }
}
