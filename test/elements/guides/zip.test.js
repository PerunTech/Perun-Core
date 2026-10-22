import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { unzipEntries, zipBlob } from '../../../frontend/elements/guides/zip'

const text = (bytes) => new TextDecoder().decode(bytes)

const patch = async (blob, edit) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  edit(new DataView(bytes.buffer))
  return new Blob([bytes])
}

const centralAt = (view) => view.getUint32(view.byteLength - 22 + 16, true)

describe('zipBlob', () => {
  it('stores the standard CRC-32 of each entry', async () => {
    const view = new DataView(await (await zipBlob([{ name: 'a', data: '123456789' }])).arrayBuffer())
    expect(view.getUint32(14, true)).toBe(0xcbf43926)
  })

  it('stores the modification time as an MS-DOS date and time', async () => {
    const when = new Date(2026, 9, 22, 13, 45, 31)
    const view = new DataView(await (await zipBlob([{ name: 'a', data: '' }], when)).arrayBuffer())
    expect(view.getUint16(10, true)).toBe((13 << 11) | (45 << 5) | 15)
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 22)
  })

  it('flags names as UTF-8', async () => {
    const view = new DataView(await (await zipBlob([{ name: 'снимка.png', data: '' }])).arrayBuffer())
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800)
  })
})

describe('unzipEntries', () => {
  it('reads back what zipBlob wrote, in order, from strings, bytes and blobs', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 255])
    const blob = await zipBlob([
      { name: 'en_US_guide.md', data: '# Guide\n' },
      { name: 'en_US_guide__снимка 1.png', data: png },
      { name: 'notes.txt', data: new Blob(['plain']) }
    ])

    const entries = await unzipEntries(blob)

    expect(blob.type).toBe('application/zip')
    expect(entries.map(entry => entry.name)).toEqual(['en_US_guide.md', 'en_US_guide__снимка 1.png', 'notes.txt'])
    expect(text(entries[0].data)).toBe('# Guide\n')
    expect(entries[1].data).toEqual(png)
    expect(text(entries[2].data)).toBe('plain')
  })

  it('reads an empty archive', async () => {
    expect(await unzipEntries(await zipBlob([]))).toEqual([])
  })

  it('leaves directories out', async () => {
    const blob = await zipBlob([{ name: 'figures/', data: '' }, { name: 'figures/a.png', data: 'x' }])
    expect((await unzipEntries(blob)).map(entry => entry.name)).toEqual(['figures/a.png'])
  })

  it('finds the end record past a zip comment', async () => {
    const archive = new Uint8Array(await (await zipBlob([{ name: 'a.md', data: 'body' }])).arrayBuffer())
    const comment = new TextEncoder().encode('written by another tool')
    const withComment = new Uint8Array(archive.length + comment.length)
    withComment.set(archive)
    withComment.set(comment, archive.length)
    new DataView(withComment.buffer).setUint16(archive.length - 2, comment.length, true)

    const entries = await unzipEntries(new Blob([withComment]))

    expect(text(entries[0].data)).toBe('body')
  })

  it('inflates a deflated entry', async () => {
    const markdown = '# Guide\n\n' + 'Repeated text compresses. '.repeat(40)
    const stored = await zipBlob([{ name: 'a.md', data: deflateRawSync(Buffer.from(markdown)) }])
    const deflated = await patch(stored, (view) => {
      view.setUint16(8, 8, true)
      view.setUint16(centralAt(view) + 10, 8, true)
    })

    const entries = await unzipEntries(deflated)

    expect(text(entries[0].data)).toBe(markdown)
  })

  it('turns away an unknown compression method', async () => {
    const blob = await patch(await zipBlob([{ name: 'a.md', data: 'x' }]), (view) => {
      view.setUint16(centralAt(view) + 10, 14, true)
    })
    await expect(unzipEntries(blob)).rejects.toThrow('a.md uses compression method 14')
  })

  it('turns away an encrypted entry', async () => {
    const blob = await patch(await zipBlob([{ name: 'a.md', data: 'x' }]), (view) => {
      const at = centralAt(view) + 8
      view.setUint16(at, view.getUint16(at, true) | 1, true)
    })
    await expect(unzipEntries(blob)).rejects.toThrow('a.md is encrypted')
  })

  it('turns away something that is not an archive', async () => {
    await expect(unzipEntries(new Blob(['# just Markdown']))).rejects.toThrow('no end record')
  })

  it('turns away an end record that points past the archive', async () => {
    const archive = new Uint8Array(await (await zipBlob([{ name: 'a.md', data: 'body' }])).arrayBuffer())
    const view = new DataView(archive.buffer)
    view.setUint32(view.byteLength - 22 + 16, archive.length, true)
    await expect(unzipEntries(new Blob([archive]))).rejects.toThrow('damaged central directory')
  })
})
