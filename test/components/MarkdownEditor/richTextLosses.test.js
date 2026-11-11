import { describe, expect, it } from 'vitest'
import { marked } from 'marked'
import { richTextLosses } from '../../../frontend/components/MarkdownEditor/richTextLosses'

const losses = (markdown) => richTextLosses(marked.lexer(markdown, { gfm: true }))

describe('richTextLosses', () => {
  it('finds nothing in a guide rich text can write back', () => {
    expect(losses('# Title\n\nText with **bold** and a [link](x).\n\n- a\n- b\n\n| A | B |\n|:-|-:|\n| 1 | 2 |\n\n![f](f.png)')).toEqual([])
  })

  it('lets a line break through', () => {
    expect(losses('one<br>two\n\n| A |\n|---|\n| x<br/>y |')).toEqual([])
  })

  it.each([
    ['a block', '<div>block</div>'],
    ['inline', 'Text with <span>html</span>.'],
    ['a comment', '<!-- a note -->\n\nText'],
    ['in a list', '- item with <kbd>Ctrl</kbd>'],
    ['in a table cell', '| A |\n|---|\n| <b>x</b> |'],
    ['in a quote', '> quoted <i>html</i>'],
  ])('finds raw HTML %s', (_where, markdown) => {
    expect(losses(markdown)).toEqual(['html'])
  })

  it('finds task list checkboxes, nested too', () => {
    expect(losses('- [ ] todo\n- [x] done')).toEqual(['tasks'])
    expect(losses('- a\n  - [ ] nested')).toEqual(['tasks'])
  })

  it('reports each kind once, in a fixed order', () => {
    expect(losses('- [ ] <b>both</b>\n- [x] <i>again</i>')).toEqual(['html', 'tasks'])
  })
})
