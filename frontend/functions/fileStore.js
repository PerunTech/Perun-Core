import axios from 'axios'

/*
 * Svarog's file store, through the ReactElements endpoints: files attached to an object, listed,
 * downloaded, uploaded and deleted. The user guides and the rich text documents both keep their
 * files here.
 */

// getUploadedFiles reads "0" as "no filter" and answers with every file on the object, which is the
// convention the attachment menus already use. One listing per object therefore covers every kind
// of file on it, where asking per type costs a round trip each.
export const ALL_FILE_TYPES = '0'

// svCONST.OBJECT_TYPE_FILE. The delete endpoint takes the type as a number, and the file rows
// getUploadedFiles returns carry the same value in object_type.
const OBJECT_TYPE_FILE = 2

/* ------------------------------------------------------------------ notes -- */

// FILE_NOTES travels to the server as a path segment on the upload URL, and the endpoint is
// @Encoded so whatever arrives is stored verbatim. Route values contain slashes, and a
// percent-encoded slash in a path is rejected outright by a default Tomcat configuration, so the
// notes are base64url encoded: no slashes, no braces, nothing a container will argue with.
const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (encoded) => {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - padded.length % 4) % 4))
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
}

export const encodeNotes = (notes) => toBase64Url(JSON.stringify(notes ?? {}))

/**
 * Reads the notes back off a file row. Tolerates the three forms a note can arrive in:
 * base64url written by encodeNotes, bare JSON, or percent-encoded JSON written by hand.
 */
export const decodeNotes = (raw) => {
  const text = (raw ?? '').trim()
  if (!text) return {}

  const attempts = [
    () => JSON.parse(fromBase64Url(text)),
    () => JSON.parse(text),
    () => JSON.parse(decodeURIComponent(text))
  ]

  for (const attempt of attempts) {
    try {
      const parsed = attempt()
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* try the next encoding */ }
  }
  return {}
}

/* ------------------------------------------------------------------ types -- */

const MIME_BY_EXTENSION = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  md: 'text/markdown', pdf: 'application/pdf', html: 'text/html'
}

export const mimeFromName = (fileName) => {
  const extension = (fileName ?? '').split('.').pop()?.toLowerCase()
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

/* --------------------------------------------------------------- readers -- */

// getUploadedFiles answers with Jsonable.toSimpleJson() over a DbDataArray. Observed shape is
// { indexField, filter, items: [ { object_id, FILE_NAME, ... } ] }: repo columns and field values
// sit flat on the item, there is no nested values object. An empty result skips toSimpleJson
// entirely and sends data: {}. The readers below still tolerate a bare array and a nested values
// object, so a serialization change degrades to an empty list instead of a crash.
/**
 * The response, or a throw when there is none, so a missing answer is never read as an empty list.
 * A genuinely empty result still has a response: the backend skips toSimpleJson and sends data: {}.
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

const toFileRecord = (item) => {
  const fileName = readValue(item, 'FILE_NAME')
  return {
    objectId: readObjectId(item),
    fileName,
    fileType: readValue(item, 'FILE_TYPE'),
    fileSize: readValue(item, 'FILE_SIZE'),
    fileDate: readValue(item, 'FILE_DATE'),
    contentType: readValue(item, 'CONTENT_TYPE') || mimeFromName(fileName),
    notes: decodeNotes(readValue(item, 'FILE_NOTES'))
  }
}

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

/* ------------------------------------------------------------------- rest -- */

/**
 * The files of one type on an object, every version of each. `objectType` is the svarog table
 * name: the endpoints resolve it through SvCore.getTypeIdByName, which fails on a short name.
 */
export const listFiles = async (svSession, { objectId, objectType, fileType = ALL_FILE_TYPES }) => {
  const url = `${window.server}/ReactElements/getUploadedFiles/sid/${svSession}`
    + `/object-id/${objectId}/object-type/${objectType}/file-type/${fileType}`
  const response = requireResponse(await axios.get(url))
  return readItems(response?.data).map(toFileRecord).filter(record => record.objectId && record.fileName)
}

/**
 * Fetches file bytes as a Blob. CONTENT_TYPE is null for every row written by the current upload
 * path, and downloadFile answers application/octet-stream regardless, so the type is taken from the
 * record and only then from the response.
 */
export const fetchFileBlob = async (svSession, record) => {
  const url = `${window.server}/ReactElements/downloadFile/sid/${svSession}`
    + `/object-id/${record.objectId}/file-name/${encodeURIComponent(record.fileName)}`
  const response = requireResponse(await axios.get(url, { responseType: 'blob' }))
  return new Blob([response?.data], { type: record.contentType || mimeFromName(record.fileName) })
}

export const fetchFileText = async (svSession, record) => {
  const blob = await fetchFileBlob(svSession, record)
  return blob.text()
}

/**
 * Uploads one file. The single-file endpoint is the only one that accepts a note, so saves
 * always go through here; the bulk endpoint hardcodes it to null.
 */
export const uploadFile = async (svSession, { objectId, objectType, fileType, file, fileName, notes }) => {
  const payload = new FormData()
  payload.append('file', file, fileName ?? file.name)

  const url = `${window.server}/ReactElements/uploadFile/sid/${svSession}`
    + `/object-id/${objectId}/object-type/${objectType}/file-type/${fileType}`
    + `/note/${encodeNotes(notes)}`

  const response = requireResponse(await axios.post(url, payload, { headers: { 'Content-Type': 'multipart/form-data' } }))
  return response?.data
}

/**
 * Invalidates one file object and the link that attached it.
 *
 * deleteObject reads its payload from the *key* of a form-urlencoded body, which is why the JSON
 * goes through encodeURIComponent and there is no value half. deleteLinks is on so the row in
 * SVAROG_LINK goes with the file rather than being left dangling at the object.
 */
export const deleteFile = async (svSession, objectId) => {
  const payload = JSON.stringify({ OBJECT_ID: Number(objectId), OBJECT_TYPE: OBJECT_TYPE_FILE })
  const url = `${window.server}/ReactElements/deleteObject/${svSession}/false/true`
  const response = requireResponse(await axios.post(url, encodeURIComponent(payload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }))
  if (String(response?.data?.type).toUpperCase() === 'ERROR') throw new Error(response.data.message)
  return response?.data
}

/**
 * Object URLs held per file object id. createObjectURL keeps the bytes alive until revoked, so an
 * illustrated document opened repeatedly would pin every image for the life of the tab.
 */
export const createBlobCache = () => {
  const urls = new Map()

  return {
    async get(svSession, record) {
      if (!record?.objectId) return null
      if (urls.has(record.objectId)) return urls.get(record.objectId)
      const blob = await fetchFileBlob(svSession, record)
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
