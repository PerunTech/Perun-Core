import { describe, expect, it } from 'vitest'
import { decodeNotes, encodeNotes } from '../../../frontend/elements/guides/helpNotes'

describe('encodeNotes', () => {
  it('writes something a URL path segment carries as it is', () => {
    const encoded = encodeNotes({ route: '/aims/holdings?x=1', title: 'Пребарување ✓' })
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('round-trips through decodeNotes', () => {
    const notes = { route: '/aims/holdings', title: 'Пребарување ✓', order: 2 }
    expect(decodeNotes(encodeNotes(notes))).toEqual(notes)
    expect(decodeNotes(encodeNotes(null))).toEqual({})
  })
})

describe('decodeNotes', () => {
  it('reads bare JSON', () => {
    expect(decodeNotes(' {"route":"/a"} ')).toEqual({ route: '/a' })
  })

  it('reads percent-encoded JSON', () => {
    expect(decodeNotes(encodeURIComponent('{"route":"/a"}'))).toEqual({ route: '/a' })
  })

  it('answers {} for nothing, for garbage and for JSON that is not an object', () => {
    expect(decodeNotes(null)).toEqual({})
    expect(decodeNotes('   ')).toEqual({})
    expect(decodeNotes('not notes at all')).toEqual({})
    expect(decodeNotes('42')).toEqual({})
    expect(decodeNotes(encodeNotes('a string'))).toEqual({})
  })
})
