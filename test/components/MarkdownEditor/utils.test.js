import { describe, expect, it } from 'vitest'
import { formatStats } from '../../../frontend/components/MarkdownEditor/utils'

describe('formatStats', () => {
  it('counts the words and the bytes of Markdown as written', () => {
    expect(formatStats('# One two\n\nthree')).toBe('4 words · 16 B')
    expect(formatStats('')).toBe('0 words · 0 B')
  })

  it('counts the words of HTML without its tags', () => {
    expect(formatStats('<p>One&nbsp;<strong>two</strong></p><p>three</p>', { html: true })).toMatch(/^3 words · /)
    expect(formatStats('<p></p>', { html: true })).toMatch(/^0 words · /)
    expect(formatStats('<p>bo<strong>ld</strong> and <a href="x">a link</a>.</p><ul><li><p>one</p></li></ul>', { html: true })).toMatch(/^5 words · /)
  })
})
