/**
 * A zip writer and reader, enough to move one guide with its figures.
 *
 * Entries are stored rather than deflated. Compression would mean carrying an implementation this
 * project does not have, and would buy close to nothing: the figures are already PNG and JPEG, and
 * the Markdown beside them is a few kilobytes. Every extractor reads a stored entry.
 *
 * Reading is the looser half of the two. What we write we read back, but an archive that has been
 * through another tool on the way is still a guide, so a deflated entry is inflated rather than
 * refused.
 *
 * Nothing here handles zip64, which an archive of this size cannot need: the 32-bit size and offset
 * fields only run out past 4GB.
 */

// The standard CRC-32 (reflected polynomial 0xedb88320), built once. The format stores one per
// entry and extractors do check it, so this cannot be skipped.
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

/**
 * The MS-DOS date and time the format stores. Seconds are halved because the field has one bit
 * fewer than it needs for them, which is the format's own rounding and not a loss worth avoiding.
 */
const dosStamp = (when) => ({
  time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
  date: ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
})

const toBytes = async (data) => {
  if (data instanceof Uint8Array) return data
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return new Uint8Array(await data.arrayBuffer())
}

// Names are written as UTF-8 and flagged as such (general purpose bit 11), which is the only way
// the format has to say so. Without the flag a name outside ASCII is read as code page 437.
const UTF8_NAMES = 0x0800
const LOCAL_HEADER = 30
const CENTRAL_HEADER = 46
const END_RECORD = 22

/**
 * Packs entries into one archive.
 *
 * @param {Array<{name: string, data: Blob|Uint8Array|string}>} entries in the order they are stored
 * @param {Date} when the modification time written to every entry
 * @returns {Promise<Blob>} the archive, ready to hand to a download
 */
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

/* ------------------------------------------------------------------ read -- */

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50

// Bit 0 of the general purpose flags. An encrypted entry reads as noise rather than failing, so it
// has to be turned away by name.
const ENCRYPTED = 0x0001

const STORED = 0
const DEFLATED = 8

/**
 * The end record sits last, but a zip comment may follow it, so it is searched for backwards over
 * the comment's maximum length rather than assumed to be at a fixed offset from the end.
 */
const findEndRecord = (view) => {
  const earliest = Math.max(0, view.byteLength - END_RECORD - 0xffff)
  for (let at = view.byteLength - END_RECORD; at >= earliest; at -= 1) {
    if (view.getUint32(at, true) === END_SIGNATURE) return at
  }
  return -1
}

// A zip entry holds a bare deflate stream, with none of zlib's header or checksum around it, which
// is what deflate-raw means. Browsers without DecompressionStream get a clear failure rather than
// a corrupt figure.
const inflate = async (bytes) => {
  if (typeof DecompressionStream !== 'function') throw new Error('zip: deflate is not supported here')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Unpacks an archive.
 *
 * The central directory is read rather than the local headers, because an entry written with a
 * data descriptor (general purpose bit 3) carries zeros for its sizes in the local header and the
 * true ones only in the directory. Our writer does not do that; other tools do.
 *
 * @param {Blob} blob the archive
 * @returns {Promise<Array<{name: string, data: Uint8Array}>>} its files, directories left out
 */
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

    // A trailing slash is the format's only mark of a directory, and it carries no data.
    if (name.endsWith('/')) continue
    if (flags & ENCRYPTED) throw new Error(`zip: ${name} is encrypted`)

    if (view.getUint32(localAt, true) !== LOCAL_SIGNATURE) throw new Error(`zip: ${name} is misplaced`)
    // The local copies of these two lengths are the ones that locate the data. The central
    // directory's extra field is allowed to differ in length from the local one.
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
