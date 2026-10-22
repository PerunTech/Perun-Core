// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { LINE_ATTR, loadMarkdown, markdownReady, renderMarkdown } from '../../../frontend/elements/guides/renderMarkdown'

vi.mock('../../../frontend/functions/modules', () => ({ loadModule: () => import('../../../frontend/modules/markdown.js') }))

const html = (fragment) => {
  const div = document.createElement('div')
  div.append(fragment)
  return div
}

describe('renderMarkdown', () => {
  it('throws until loadMarkdown has resolved', async () => {
    expect(markdownReady()).toBe(false)
    expect(() => renderMarkdown('# Holdings')).toThrow('renderMarkdown ran before loadMarkdown resolved')
    const { marked, DOMPurify } = await loadMarkdown()
    expect(typeof marked.lexer).toBe('function')
    expect(typeof DOMPurify.sanitize).toBe('function')
    expect(markdownReady()).toBe(true)
  })

  it('stamps each block with the line it starts on', () => {
    const div = html(renderMarkdown('# Holdings\n\nA paragraph\nover two lines.\n\n- one\n- two\n\n## Search'))
    expect([...div.querySelectorAll(`[${LINE_ATTR}]`)].map((el) => `${el.tagName}:${el.getAttribute(LINE_ATTR)}`))
      .toEqual(['H1:1', 'P:3', 'UL:6', 'H2:9'])
  })

  it('keeps the lines after a block the sanitizer drops', () => {
    const div = html(renderMarkdown('<script>alert(1)</script>\n\nAfter it'))
    expect(div.querySelector('script')).toBeNull()
    expect(div.querySelector('p').getAttribute(LINE_ATTR)).toBe('3')
  })

  it('drops what a guide may not carry', () => {
    const div = html(renderMarkdown([
      '<iframe src="https://example.com"></iframe>',
      '',
      '<p onclick="alert(1)" data-x="1" style="color:red">Text</p>',
      '',
      '[Run](javascript:alert(1)) and **bold**'
    ].join('\n')))
    expect(div.querySelector('iframe')).toBeNull()
    const p = div.querySelector('p')
    expect(p.getAttribute('onclick')).toBeNull()
    expect(p.getAttribute('data-x')).toBeNull()
    expect(p.getAttribute('style')).toBeNull()
    expect(div.querySelector('a').getAttribute('href')).toBeNull()
    expect(div.querySelector('strong').textContent).toBe('bold')
  })

  it('keeps tables', () => {
    const div = html(renderMarkdown('| Code | Name |\n| --- | --- |\n| BRU | Brucellosis |'))
    expect([...div.querySelectorAll('table > thead > tr > th')].map((th) => th.textContent)).toEqual(['Code', 'Name'])
    expect([...div.querySelectorAll('table > tbody > tr > td')].map((td) => td.textContent)).toEqual(['BRU', 'Brucellosis'])
  })

  it('opens every link outside the app', () => {
    const a = html(renderMarkdown('[Svarog](https://example.com/docs)')).querySelector('a')
    expect(a.getAttribute('href')).toBe('https://example.com/docs')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('sets a figure from the name the author wrote, spaces and Cyrillic included', () => {
    const resolveImage = vi.fn((name) => ({ 'map 1.png': 'blob:map', 'карта.png': 'blob:karta' })[name] ?? null)
    const imgs = html(renderMarkdown('![Map](<map 1.png>)\n\n![Карта](карта.png)', resolveImage)).querySelectorAll('img')
    expect([...imgs].map((img) => img.getAttribute('src'))).toEqual(['blob:map', 'blob:karta'])
    expect(resolveImage).toHaveBeenCalledWith('map 1.png')
    expect(imgs[0].getAttribute('alt')).toBe('Map')
  })

  it('marks a figure it cannot resolve, with no source', () => {
    const img = html(renderMarkdown('![Map](map.png)', () => null)).querySelector('img')
    expect(img.getAttribute('src')).toBeNull()
    expect(img.getAttribute('data-help-missing-image')).toBe('map.png')
    expect(html(renderMarkdown('![Map](map.png)')).querySelector('img').getAttribute('data-help-missing-image')).toBe('map.png')
  })

  it('renders no document as nothing', () => {
    expect(html(renderMarkdown(null)).innerHTML).toBe('')
  })
})
