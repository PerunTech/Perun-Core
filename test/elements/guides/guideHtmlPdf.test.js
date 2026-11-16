// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { htmlGuideDocDefinition } from '../../../frontend/elements/guides/guideHtmlPdf'
import { COLORS } from '../../../frontend/elements/guides/guidePdf'

const content = (html, { title, figures } = {}) => htmlGuideDocDefinition({ title, html, figures }).content
const plain = (node) => (Array.isArray(node.text) ? node.text.map(run => run.text).join('') : node.text)

const FIGURE = { kind: 'png', dataUri: 'data:image/png;base64,AA', width: 200, height: 100 }

describe('htmlGuideDocDefinition', () => {
  it('sets the title and drops a first heading that repeats it', () => {
    const [title, heading, paragraph] = content('<h1>Searching  Holdings</h1><h2>Steps</h2><p>Go.</p>', { title: 'Searching holdings' })
    expect(title).toEqual({ text: 'Searching holdings', style: 'title' })
    expect([plain(heading), heading.style]).toEqual(['Steps', 'h2'])
    expect([plain(paragraph), paragraph.style]).toEqual(['Go.', 'paragraph'])
  })

  it('carries the marks and links into the runs, the line ends trimmed', () => {
    const [paragraph] = content('<p>  Some <strong>bold</strong>, <em>italic</em>, <u>under</u>, <s>gone</s>, <code>code</code> and <a href="https://perun.tech">a <strong>link</strong></a>  </p>')
    expect(paragraph.text).toEqual([
      { text: 'Some ' },
      { text: 'bold', bold: true },
      { text: ', ' },
      { text: 'italic', italics: true },
      { text: ', ' },
      { text: 'under', decoration: 'underline' },
      { text: ', ' },
      { text: 'gone', decoration: 'lineThrough' },
      { text: ', ' },
      { text: 'code', color: COLORS.code },
      { text: ' and ' },
      { text: 'a ', color: COLORS.accent, decoration: 'underline', link: 'https://perun.tech' },
      { text: 'link', color: COLORS.accent, decoration: 'underline', link: 'https://perun.tech', bold: true }
    ])
  })

  it('splits a paragraph at a figure, captioned by its alt', () => {
    const blocks = content('<p>Before <img src="map.png" alt="The map"> after<br>more</p>', { figures: { 'map.png': FIGURE } })
    expect(blocks.map(block => block.image ? 'image' : plain(block))).toEqual(['Before', 'image', 'The map', 'after\nmore'])
    expect(blocks[2].style).toBe('caption')
  })

  it('marks a figure it has no image for, under its decoded name', () => {
    const blocks = content('<p><img src="my%20figure.png"></p>')
    expect(blocks).toEqual([{ text: '[my figure.png]', style: 'missing' }])
  })

  it('draws lists tight, with an ordered list keeping its start', () => {
    const [list] = content('<ol start="3"><li><p>one</p></li><li><p>two</p><ul><li><p>nested</p></li></ul></li></ol>')
    expect(list.start).toBe(3)
    expect(list.ol[0]).toEqual({ text: [{ text: 'one' }], style: 'paragraphTight' })
    expect(list.ol[1].stack.map(part => part.ul ? 'ul' : plain(part))).toEqual(['two', 'ul'])
    expect(plain(list.ol[1].stack[1].ul[0])).toBe('nested')
    expect(content('<ol start="1"><li>a</li></ol>')[0].start).toBeUndefined()
  })

  it('places merged cells in the grid, with a placeholder in each place they cover', () => {
    const [table] = content([
      '<table><tbody>',
      '<tr><th>A</th><th>B</th><th>C</th></tr>',
      '<tr><td colspan="2">wide</td><td rowspan="2">tall</td></tr>',
      '<tr><td>x</td></tr>',
      '</tbody></table>'
    ].join(''))
    const { headerRows, body, widths } = table.table
    expect(headerRows).toBe(1)
    expect(widths).toHaveLength(3)
    expect(body[0].map(cell => [plain(cell), cell.bold, cell.fillColor])).toEqual([
      ['A', true, COLORS.sunk], ['B', true, COLORS.sunk], ['C', true, COLORS.sunk]
    ])
    expect([plain(body[1][0]), body[1][0].colSpan, body[1][1], plain(body[1][2]), body[1][2].rowSpan]).toEqual(['wide', 2, {}, 'tall', 2])
    expect(body[2]).toEqual([{ text: [{ text: 'x' }] }, { text: '' }, {}])
  })

  it('keeps a figure in a cell inline, as its alt', () => {
    const [table] = content('<table><tr><td><p>See <img src="map.png" alt="Map"></p></td></tr></table>', { figures: { 'map.png': FIGURE } })
    expect(table.table.headerRows).toBe(0)
    expect(table.table.body[0][0].text).toEqual([{ text: 'See ' }, { text: 'Map', italics: true }])
  })

  it('draws quotes, code and rules, and leaves out what never shows', () => {
    const blocks = content('<blockquote><p>quoted</p></blockquote><pre><code>const a = 1\n</code></pre><hr><script>alert(1)</script><style>p{}</style><div>loose <b>text</b></div>')
    expect(blocks.map(block => block.style ?? (block.canvas ? 'rule' : undefined))).toEqual(['quote', 'codeBlock', 'rule', 'paragraph'])
    expect(plain(blocks[0].table.body[0][0].stack[0])).toBe('quoted')
    expect(blocks[1].table.body[0][0].text).toBe('const a = 1')
    expect(plain(blocks[3])).toBe('loose text')
  })

  it('gives an empty document no content but the title', () => {
    expect(content('', { title: 'Empty' })).toEqual([{ text: 'Empty', style: 'title' }])
    expect(content(undefined)).toEqual([])
  })
})
