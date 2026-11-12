// Writes stored entries, since the figures are already compressed. Reads deflated ones too, for an
// archive repacked by another tool. No zip64.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// The format stores seconds halved.
const dosStamp = (when) => ({
  time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
  date: ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
})

const toBytes = async (data) => {
  if (data instanceof Uint8Array) return data
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return new Uint8Array(await data.arrayBuffer())
}

// Without bit 11 a non-ASCII name is read as code page 437.
const UTF8_NAMES = 0x0800
const LOCAL_HEADER = 30
const CENTRAL_HEADER = 46
const END_RECORD = 22

export const zipBlob = async (entries, when = new Date()) => {
  const stamp = dosStamp(when)
  const encoder = new TextEncoder()
  const parts = []
  const directory = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = await toBytes(entry.data)
    const crc = crc32(data)

    const header = new DataView(new ArrayBuffer(LOCAL_HEADER))
    header.setUint32(0, 0x04034b50, true)
    header.setUint16(4, 20, true)
    header.setUint16(6, UTF8_NAMES, true)
    header.setUint16(8, 0, true)
    header.setUint16(10, stamp.time, true)
    header.setUint16(12, stamp.date, true)
    header.setUint32(14, crc, true)
    header.setUint32(18, data.length, true)
    header.setUint32(22, data.length, true)
    header.setUint16(26, name.length, true)
    header.setUint16(28, 0, true)

    parts.push(header.buffer, name, data)
    directory.push({ name, data, crc, offset })
    offset += LOCAL_HEADER + name.length + data.length
  }

  const central = []
  let centralSize = 0

  for (const entry of directory) {
    const header = new DataView(new ArrayBuffer(CENTRAL_HEADER))
    header.setUint32(0, 0x02014b50, true)
    header.setUint16(4, 20, true)
    header.setUint16(6, 20, true)
    header.setUint16(8, UTF8_NAMES, true)
    header.setUint16(10, 0, true)
    header.setUint16(12, stamp.time, true)
    header.setUint16(14, stamp.date, true)
    header.setUint32(16, entry.crc, true)
    header.setUint32(20, entry.data.length, true)
    header.setUint32(24, entry.data.length, true)
    header.setUint16(28, entry.name.length, true)
    header.setUint16(30, 0, true)
    header.setUint16(32, 0, true)
    header.setUint16(34, 0, true)
    header.setUint16(36, 0, true)
    header.setUint32(38, 0, true)
    header.setUint32(42, entry.offset, true)

    central.push(header.buffer, entry.name)
    centralSize += CENTRAL_HEADER + entry.name.length
  }

  const end = new DataView(new ArrayBuffer(END_RECORD))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(4, 0, true)
  end.setUint16(6, 0, true)
  end.setUint16(8, directory.length, true)
  end.setUint16(10, directory.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  end.setUint16(20, 0, true)

  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' })
}

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50

// An encrypted entry reads as noise rather than failing, so it is refused by this flag.
const ENCRYPTED = 0x0001

const STORED = 0
const DEFLATED = 8

// A zip comment may follow the end record, so it is searched for backwards.
const findEndRecord = (view) => {
  const earliest = Math.max(0, view.byteLength - END_RECORD - 0xffff)
  for (let at = view.byteLength - END_RECORD; at >= earliest; at -= 1) {
    if (view.getUint32(at, true) === END_SIGNATURE) return at
  }
  return -1
}

// A bare deflate stream with no zlib header, which is what deflate-raw reads.
const inflate = async (bytes) => {
  if (typeof DecompressionStream !== 'function') throw new Error('zip: deflate is not supported here')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Read from the central directory: an entry with a data descriptor (bit 3) has zero sizes in its local
// header.
export const unzipEntries = async (blob) => {
  const buffer = await blob.arrayBuffer()
  const view = new DataView(buffer)
  const end = findEndRecord(view)
  if (end < 0) throw new Error('zip: no end record, this is not an archive')

  const count = view.getUint16(end + 10, true)
  const decoder = new TextDecoder()
  const entries = []
  let at = view.getUint32(end + 16, true)

  for (let index = 0; index < count; index += 1) {
    if (at + CENTRAL_HEADER > view.byteLength || view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      throw new Error('zip: damaged central directory')
    }

    const flags = view.getUint16(at + 8, true)
    const method = view.getUint16(at + 10, true)
    const compressed = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const localAt = view.getUint32(at + 42, true)
    const name = decoder.decode(new Uint8Array(buffer, at + CENTRAL_HEADER, nameLength))
    at += CENTRAL_HEADER + nameLength + extraLength + commentLength

    // A trailing slash marks a directory.
    if (name.endsWith('/')) continue
    if (flags & ENCRYPTED) throw new Error(`zip: ${name} is encrypted`)

    if (view.getUint32(localAt, true) !== LOCAL_SIGNATURE) throw new Error(`zip: ${name} is misplaced`)
    // The local lengths locate the data; the central directory's extra field may differ in length.
    const dataAt = localAt + LOCAL_HEADER
      + view.getUint16(localAt + 26, true)
      + view.getUint16(localAt + 28, true)
    if (dataAt + compressed > view.byteLength) throw new Error(`zip: ${name} runs past the end`)

    const data = new Uint8Array(buffer, dataAt, compressed)
    if (method === STORED) entries.push({ name, data: data.slice() })
    else if (method === DEFLATED) entries.push({ name, data: await inflate(data) })
    else throw new Error(`zip: ${name} uses compression method ${method}`)
  }

  return entries
}
