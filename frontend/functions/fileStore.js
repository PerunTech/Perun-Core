import axios from 'axios'

// getUploadedFiles reads "0" as no filter, so one listing covers every file type on the object.
export const ALL_FILE_TYPES = '0'

// svCONST.OBJECT_TYPE_FILE, which the delete endpoint takes as a number.
const OBJECT_TYPE_FILE = 2

// Notes go as a path segment of the upload URL, and Tomcat rejects a percent-encoded slash, so they
// are base64url.
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

// Base64url from encodeNotes, bare JSON, or percent-encoded JSON written by hand.
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

const MIME_BY_EXTENSION = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  md: 'text/markdown', pdf: 'application/pdf', html: 'text/html'
}

export const mimeFromName = (fileName) => {
  const extension = (fileName ?? '').split('.').pop()?.toLowerCase()
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

// A missing answer throws rather than reading as an empty list; an empty result arrives as data: {}.
export const requireResponse = (response) => {
  if (!response) throw new Error('The request did not complete')
  return response
}

// Items sit flat ({ items: [{ object_id, FILE_NAME, ... }] }); a bare array or nested values pass too.
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

// Every save writes a new row, so only the newest per name counts.
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

// objectType is the svarog table name: getTypeIdByName fails on a short name.
export const listFiles = async (svSession, { objectId, objectType, fileType = ALL_FILE_TYPES }) => {
  const url = `${window.server}/ReactElements/getUploadedFiles/sid/${svSession}`
    + `/object-id/${objectId}/object-type/${objectType}/file-type/${fileType}`
  const response = requireResponse(await axios.get(url))
  return readItems(response?.data).map(toFileRecord).filter(record => record.objectId && record.fileName)
}

// CONTENT_TYPE is null on rows the current upload writes, and downloadFile always answers
// octet-stream, so the type comes from the record.
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

// The only endpoint that takes a note; the bulk one hardcodes it to null.
export const uploadFile = async (svSession, { objectId, objectType, fileType, file, fileName, notes }) => {
  const payload = new FormData()
  payload.append('file', file, fileName ?? file.name)

  const url = `${window.server}/ReactElements/uploadFile/sid/${svSession}`
    + `/object-id/${objectId}/object-type/${objectType}/file-type/${fileType}`
    + `/note/${encodeNotes(notes)}`

  const response = requireResponse(await axios.post(url, payload, { headers: { 'Content-Type': 'multipart/form-data' } }))
  return response?.data
}

// deleteObject reads its payload from the key of a form-urlencoded body. deleteLinks drops the
// SVAROG_LINK row with it.
export const deleteFile = async (svSession, objectId) => {
  const payload = JSON.stringify({ OBJECT_ID: Number(objectId), OBJECT_TYPE: OBJECT_TYPE_FILE })
  const url = `${window.server}/ReactElements/deleteObject/${svSession}/false/true`
  const response = requireResponse(await axios.post(url, encodeURIComponent(payload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }))
  if (String(response?.data?.type).toUpperCase() === 'ERROR') throw new Error(response.data.message)
  return response?.data
}

// An object URL keeps its bytes alive until revoked, so a document opened again reuses them.
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
