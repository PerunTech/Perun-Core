import { describe, expect, it } from 'vitest'
import { filesFrom, isImageFile } from '../../frontend/functions/files'

const file = (name, type = '') => new File(['x'], name, { type })

describe('isImageFile', () => {
  it('goes by the type when the browser gives one', () => {
    expect(isImageFile(file('photo', 'image/png'))).toBe(true)
    expect(isImageFile(file('photo.png', 'application/pdf'))).toBe(false)
  })

  it('goes by the name when the type is empty', () => {
    expect(isImageFile(file('scan.JPEG'))).toBe(true)
    expect(isImageFile(file('diagram.svg'))).toBe(true)
    expect(isImageFile(file('notes.txt'))).toBe(false)
  })

  it('is false for nothing', () => {
    expect(isImageFile(null)).toBe(false)
    expect(isImageFile(undefined)).toBe(false)
  })
})

describe('filesFrom', () => {
  it('takes the files list when it has any', () => {
    const a = file('a.png', 'image/png')
    const b = file('b.txt', 'text/plain')
    expect(filesFrom({ files: [a, b], items: [] })).toEqual([a, b])
  })

  it('falls back to the file items, as a copied image arrives', () => {
    const a = file('a.png', 'image/png')
    const items = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => a },
      { kind: 'file', getAsFile: () => null },
    ]
    expect(filesFrom({ files: [], items })).toEqual([a])
  })

  it('is empty for an event without a data transfer', () => {
    expect(filesFrom(null)).toEqual([])
    expect(filesFrom(undefined)).toEqual([])
  })
})
