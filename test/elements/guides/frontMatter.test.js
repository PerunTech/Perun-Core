import { describe, expect, it } from 'vitest'
import { applyFrontMatter, parseFrontMatter, serializeFrontMatter } from '../../../frontend/elements/guides/frontMatter'

describe('parseFrontMatter', () => {
  it('splits the fenced block from the body', () => {
    const raw = '---\nroute: /aims/holdings\ntitle: Searching holdings\norder: 2\n---\n# Heading\n'
    expect(parseFrontMatter(raw)).toEqual({
      meta: { route: '/aims/holdings', title: 'Searching holdings', order: '2' },
      body: '# Heading\n'
    })
  })

  it('returns a document without a fence untouched', () => {
    expect(parseFrontMatter('# Heading\n---\n')).toEqual({ meta: {}, body: '# Heading\n---\n' })
    expect(parseFrontMatter(null)).toEqual({ meta: {}, body: '' })
  })

  it('reads CRLF line endings', () => {
    expect(parseFrontMatter('---\r\ntitle: A\r\n---\r\nbody')).toEqual({ meta: { title: 'A' }, body: 'body' })
  })

  it('unquotes values and splits on the first colon only', () => {
    const { meta } = parseFrontMatter('---\ntitle: "Step 1: sign in"\nnote: \'kept\'\nurl: http://x\n---\n')
    expect(meta).toEqual({ title: 'Step 1: sign in', note: 'kept', url: 'http://x' })
  })

  it('skips comments, blank lines and lines without a key', () => {
    const { meta } = parseFrontMatter('---\n# a comment\n\n: no key\nno colon\ntitle: A\n---\n')
    expect(meta).toEqual({ title: 'A' })
  })
})

describe('serializeFrontMatter', () => {
  it('writes route, title and order first, then the rest, and drops empty values', () => {
    const raw = serializeFrontMatter({ extra: 'x', order: 3, title: 'T', route: '/r', empty: '  ', none: null }, '# Body')
    expect(raw).toBe('---\nroute: /r\ntitle: T\norder: 3\nextra: x\n---\n\n# Body')
  })

  it('quotes a value that would not survive the round trip bare', () => {
    const meta = { title: 'Step 1: sign in', route: ' /padded ' }
    const raw = serializeFrontMatter(meta, '')
    expect(raw).toContain('title: "Step 1: sign in"')
    expect(parseFrontMatter(raw).meta).toEqual(meta)
  })

  it('round-trips quotes and backslashes inside a quoted value', () => {
    const titles = ['"Quick start" guide', 'Path: C:\\guides\\', '"a\\"b"', "'single' quotes", 'He said "hi"']
    for (const title of titles) {
      expect(parseFrontMatter(serializeFrontMatter({ title }, '')).meta.title).toBe(title)
    }
  })

  it('reads a quoted value as the earlier writer escaped it', () => {
    expect(parseFrontMatter('---\ntitle: "\\"Quick start\\" guide"\n---\n').meta.title).toBe('"Quick start" guide')
  })

  it('writes the body alone, without leading blank lines, when there is no metadata', () => {
    expect(serializeFrontMatter({ title: '' }, '\n\n# Body')).toBe('# Body')
    expect(serializeFrontMatter(null, null)).toBe('')
  })
})

describe('applyFrontMatter', () => {
  it('merges the patch and keeps the body', () => {
    const raw = '---\nroute: /a\ntitle: Old\n---\n\n# Body\n'
    expect(applyFrontMatter(raw, { title: 'New', order: 1 })).toBe('---\nroute: /a\ntitle: New\norder: 1\n---\n\n# Body\n')
  })

  it('removes a key patched to empty', () => {
    expect(applyFrontMatter('---\nroute: /a\ntitle: T\n---\n\nbody', { route: '' })).toBe('---\ntitle: T\n---\n\nbody')
  })

  it('adds front matter to a document without it', () => {
    expect(applyFrontMatter('# Body', { route: '/a' })).toBe('---\nroute: /a\n---\n\n# Body')
  })
})
