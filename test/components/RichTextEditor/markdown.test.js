// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { marked } from 'marked'
import * as libs from '../../../frontend/modules/richText.js'
import { escapeBlockStarts, richTextExtensions } from '../../../frontend/components/RichTextEditor/richText'

const editors = []
// Every document read is checked against the schema, so a node in the wrong place fails here.
const editor = (content, contentType = 'markdown') => {
  const instance = new libs.Editor({ extensions: richTextExtensions(libs, { markdown: true }), content, contentType })
  editors.push(instance)
  instance.state.doc.check()
  return instance
}
afterEach(() => editors.splice(0).forEach(instance => instance.destroy()))

const roundTrip = (markdown) => editor(markdown).getMarkdown().trim()
const blocks = (instance) => {
  const found = []
  instance.state.doc.forEach(node => found.push([node.type.name, node.textContent]))
  return found
}

describe('Markdown through the rich text editor', () => {
  it.each([
    ['marks and links', 'Some **bold**, *italic*, ~~gone~~ and `code`, with a [link](https://perun.tech "Perun").'],
    ['headings', '# One\n\n## Two\n\n#### Four'],
    ['nested lists', '- one\n- two\n  - nested\n- three\n\n1. first\n2. second'],
    ['quote, rule and code', '> quoted\n> lines\n\n---\n\n```js\nconst a = 1\n```'],
    ['images', '![Figure 1](figure-1.png)\n\n![spaced](<my figure.png>)\n\n![titled](my%20file.png "A title")'],
    ['hard breaks', 'line one  \nline two'],
  ])('keeps %s as written', (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown)
  })

  it('keeps a table with its alignment and a line break in a cell', () => {
    const out = roundTrip('| A | B |\n|---|:-:|\n| 1 | **2** |\n| x<br>y | z |')
    expect(marked.parse(out)).toBe(marked.parse('| A | B |\n|---|:-:|\n| 1 | **2** |\n| x<br>y | z |'))
  })

  it('writes a table between paragraphs with no extra blank lines', () => {
    const markdown = 'Before\n\n| A   | B   |\n| --- | --- |\n| 1   | 2   |\n\nAfter'
    expect(editor(markdown).getMarkdown()).toBe(markdown)
  })

  it('gives a table without a header row its first row as the header', () => {
    const pasted = editor('<table><tr><td><p>Barn</p></td><td><p>OK</p></td></tr><tr><td><p>Shed</p></td><td><p>Bad</p></td></tr></table>', 'html')
    expect(pasted.getMarkdown().trim()).toBe('| Barn | OK  |\n| ---- | --- |\n| Shed | Bad |')
  })

  it('keeps inline code in bold, italics and links', () => {
    const markdown = 'A **`bold code`**, *`italic`* and [`linked`](https://perun.tech).'
    expect(roundTrip(markdown)).toBe(markdown)
  })

  it('keeps a fenced block in a numbered item without shifting it', () => {
    const out = roundTrip('1. Build:\n\n   ```bash\n   pnpm build\n   ```\n\n   Or use this.\n2. Next')
    expect(out).toContain('   ```bash\n   pnpm build\n   ```')
    expect(out).toContain('\n   Or use this.')
    expect(roundTrip(out)).toBe(out)
  })

  it('keeps the start of a numbered list, and reads a. and i. as text as the Help panel does', () => {
    expect(roundTrip('3. three\n4. four')).toBe('3. three\n4. four')
    expect(blocks(editor('a. not a list\ni. nor this'))).toEqual([['paragraph', 'a. not a list\ni. nor this']])
  })

  it('parses the text after a code block in a tight item', () => {
    const item = editor('- Build:\n  ```bash\n  pnpm build\n  ```\n  Or use `build-dev`.\n- Next').getJSON().content[0].content[0]
    expect(item.content.map(node => node.type)).toEqual(['paragraph', 'codeBlock', 'paragraph'])
    expect(item.content[2].content[1]).toMatchObject({ text: 'build-dev', marks: [{ type: 'code' }] })
  })

  it('writes the same Markdown on a second pass', () => {
    const once = roundTrip('Setext\n======\n\n_italic_ and 3. loose\n\n* star list\n\nline\\\nbreak')
    expect(roundTrip(once)).toBe(once)
  })

  it('has no underline to write', () => {
    expect(editor('').schema.marks.underline).toBeUndefined()
    const html = new libs.Editor({ extensions: richTextExtensions(libs) })
    editors.push(html)
    expect(html.schema.marks.underline).toBeDefined()
  })

  it('gives each editor a marked of its own', () => {
    const markedOf = () => richTextExtensions(libs, { markdown: true }).find(extension => extension.name === 'markdown').options.marked
    expect(markedOf()).not.toBe(markedOf())
  })

  it('writes an image name with a space or a bracket in its alt so it reads back the same', () => {
    const out = editor('<p><img src="my figure (2).png" alt="Fig [a]"></p>', 'html').getMarkdown().trim()
    expect(out).toBe('![Fig \\[a\\]](<my figure (2).png>)')
    expect(editor(out).getJSON().content[0]).toMatchObject({ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'my figure (2).png', alt: 'Fig [a]' } }] })
  })

  it('keeps typed text that looks like a block as text', () => {
    const typed = ['1. not a list', '# not heading', '- not a list', '+ plus', '10) paren', '---', '- - -', '=====', '~~~ fence', '#hashtag']
    const html = typed.map(text => `<p>${text}</p>`).join('') + '<p>Title<br>=====</p><p>x<br>1. after<br>- a break</p>'
    const typedIn = editor(html, 'html')
    const markdown = typedIn.getMarkdown()
    const readBack = editor(markdown)
    expect(blocks(readBack)).toEqual(blocks(typedIn))
    expect(blocks(readBack).every(([type]) => type === 'paragraph')).toBe(true)
    expect(readBack.getMarkdown()).toBe(markdown)
  })
})

describe('escapeBlockStarts', () => {
  it.each([
    ['# a', '\\# a'],
    ['  ## a', '  \\## a'],
    ['- a', '\\- a'],
    ['+ a', '\\+ a'],
    ['1. a', '1\\. a'],
    ['12) a', '12\\) a'],
    ['---', '\\---'],
    ['_ _ _', '\\_ _ _'],
    ['===', '\\==='],
    ['~~~js', '\\~~~js'],
    ['    code', 'code'],
    ['a\n1. b', 'a\n1\\. b'],
  ])('%j becomes %j', (line, escaped) => {
    expect(escapeBlockStarts(line)).toBe(escaped)
  })

  it.each(['#tag', '1.5 million', '-dash', 'a - b', '**bold**', '\\* star'])('leaves %j alone', (line) => {
    expect(escapeBlockStarts(line)).toBe(line)
  })
})
