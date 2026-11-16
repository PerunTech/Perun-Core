import { figureName } from './figureRefs'
import {
  CODE_LAYOUT, COLORS, CONTENT_WIDTH, HEADING_STYLES, QUOTE_LAYOUT, TABLE_LAYOUT,
  columnWidthsFor, figureNodes, flatten, guideDocDefinition, loadPdfMake,
} from './guidePdf'

// Walks a rich text guide's HTML the way guidePdf walks marked's tokens. What the editor writes is
// drawn; any other element passes its content through, and nothing in the parsed document runs.

const TEXT_NODE = 3
const ELEMENT_NODE = 1

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'HEAD', 'TITLE', 'META', 'LINK'])
const BLOCKS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE',
  'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'FIGCAPTION', 'MAIN', 'ASIDE', 'NAV',
])

const FILE_REFERENCE = /^[^:/?#]+$/

const isElement = (node, tag) => node.nodeType === ELEMENT_NODE && (!tag || node.tagName === tag)
const isBlock = (node) => isElement(node) && BLOCKS.has(node.tagName)

const MARKS = {
  STRONG: { bold: true },
  B: { bold: true },
  EM: { italics: true },
  I: { italics: true },
  U: { decoration: 'underline' },
  S: { decoration: 'lineThrough' },
  DEL: { decoration: 'lineThrough' },
  STRIKE: { decoration: 'lineThrough' },
  CODE: { color: COLORS.code },
}

const inlineRuns = (nodes, style = {}) => {
  const runs = []
  nodes.forEach((node) => {
    if (node.nodeType === TEXT_NODE) {
      const text = node.textContent.replace(/\s+/g, ' ')
      if (text) runs.push({ text, ...style })
      return
    }
    if (!isElement(node) || SKIPPED.has(node.tagName)) return

    if (node.tagName === 'BR') {
      runs.push({ text: '\n', ...style })
    } else if (node.tagName === 'IMG') {
      // A figure stands as its alt where pdfmake can't place an image: in a heading or a cell.
      const alt = node.getAttribute('alt')
      if (alt) runs.push({ text: alt, ...style, italics: true })
    } else if (node.tagName === 'A' && node.getAttribute('href')) {
      runs.push(...inlineRuns(node.childNodes, {
        ...style, color: COLORS.accent, decoration: 'underline', link: node.getAttribute('href'),
      }))
    } else {
      runs.push(...inlineRuns(node.childNodes, { ...style, ...MARKS[node.tagName] }))
    }
  })
  return runs
}

// HTML collapses the whitespace at a line's ends, so the runs do too.
const trimRuns = (runs) => {
  const out = runs.map(run => ({ ...run }))
  while (out.length && !out[0].text.replace(/^ +/, '')) out.shift()
  while (out.length && !out[out.length - 1].text.replace(/ +$/, '')) out.pop()
  if (out.length) {
    out[0].text = out[0].text.replace(/^ +/, '')
    out[out.length - 1].text = out[out.length - 1].text.replace(/ +$/, '')
  }
  return out
}

const figureBlocks = (img, context) => {
  const src = img.getAttribute('src') ?? ''
  const name = FILE_REFERENCE.test(src) ? figureName(src) : src
  const alt = img.getAttribute('alt') ?? ''
  return figureNodes(context.figures?.[name], alt, alt || name)
}

// pdfmake has no inline image, so a figure splits its paragraph.
const paragraphBlocks = (nodes, context) => {
  const out = []
  let pending = []

  const flush = () => {
    const runs = trimRuns(pending)
    if (runs.length) out.push({ text: runs, style: context.tight ? 'paragraphTight' : 'paragraph' })
    pending = []
  }

  nodes.forEach((node) => {
    if (isElement(node, 'IMG') && !context.inlineFigures) {
      flush()
      out.push(...figureBlocks(node, context))
    } else {
      pending.push(...inlineRuns([node]))
    }
  })

  flush()
  return out
}

const listBlock = (list, context) => {
  const items = [...list.children].filter(child => child.tagName === 'LI').map((item) => {
    const parts = blocksFor(item.childNodes, { ...context, tight: true })
    if (!parts.length) return { text: '' }
    return parts.length === 1 ? parts[0] : { stack: parts }
  })

  const node = { style: 'list', markerColor: COLORS.muted }
  if (list.tagName === 'UL') return { ...node, ul: items }

  const start = Number(list.getAttribute('start'))
  return { ...node, ol: items, ...(Number.isFinite(start) && list.hasAttribute('start') && start !== 1 ? { start } : {}) }
}

const rowsOf = (table) => [...table.children].flatMap((child) => {
  if (child.tagName === 'TR') return [child]
  if (['THEAD', 'TBODY', 'TFOOT'].includes(child.tagName)) return [...child.children].filter(row => row.tagName === 'TR')
  return []
})

const span = (cell, name, limit) => Math.min(Math.max(Number.parseInt(cell.getAttribute(name), 10) || 1, 1), limit)

const longestLine = (text) => text.split('\n').reduce((longest, line) => Math.max(longest, line.trim().length), 0)

// A merged cell takes its place in the grid, and pdfmake wants an empty object in each place it covers.
const tableBlock = (table, context) => {
  const rows = rowsOf(table)
  if (!rows.length) return null

  const body = rows.map(() => [])
  const lengths = []

  rows.forEach((row, rowIndex) => {
    let column = 0
    ;[...row.children].filter(cell => cell.tagName === 'TD' || cell.tagName === 'TH').forEach((cell) => {
      while (body[rowIndex][column] !== undefined) column += 1
      const colSpan = span(cell, 'colspan', 1000)
      const rowSpan = span(cell, 'rowspan', rows.length - rowIndex)

      const parts = blocksFor(cell.childNodes, { ...context, tight: true, inlineFigures: true })
      const header = cell.tagName === 'TH'
      let node = { stack: parts }
      if (!parts.length) node = { text: '' }
      else if (parts.length === 1 && parts[0].text !== undefined) node = { text: parts[0].text }
      if (header) Object.assign(node, { bold: true, fillColor: COLORS.sunk })
      if (colSpan > 1) node.colSpan = colSpan
      if (rowSpan > 1) node.rowSpan = rowSpan

      for (let down = 0; down < rowSpan; down += 1) {
        for (let across = 0; across < colSpan; across += 1) {
          body[rowIndex + down][column + across] = down === 0 && across === 0 ? node : {}
        }
      }
      if (colSpan === 1) lengths[column] = Math.max(lengths[column] ?? 0, longestLine(cell.textContent))
      column += colSpan
    })
  })

  const columns = Math.max(...body.map(row => row.length), 1)
  body.forEach((row) => {
    for (let column = 0; column < columns; column += 1) {
      if (row[column] === undefined) row[column] = { text: '' }
    }
  })

  const headed = [...rows[0].children].every(cell => cell.tagName === 'TH')
  return {
    style: 'table',
    table: {
      headerRows: headed && rows.length > 1 ? 1 : 0,
      widths: columnWidthsFor(Array.from({ length: columns }, (_, column) => lengths[column] ?? 0)),
      dontBreakRows: true,
      body,
    },
    layout: { ...TABLE_LAYOUT, fillColor: () => null },
  }
}

const elementBlocks = (element, context) => {
  const tag = element.tagName
  const level = HEADING_STYLES.findIndex((_, index) => tag === `H${index + 1}`)
  if (level !== -1) {
    const runs = trimRuns(inlineRuns(element.childNodes))
    return runs.length ? [{ text: runs, style: HEADING_STYLES[level] }] : []
  }

  switch (tag) {
    case 'P':
      return paragraphBlocks([...element.childNodes], context)
    case 'UL':
    case 'OL':
      return [listBlock(element, context)]
    case 'BLOCKQUOTE':
      return [{
        style: 'quote',
        table: { widths: ['*'], body: [[{ stack: blocksFor(element.childNodes, { ...context, tight: false }) }]] },
        layout: QUOTE_LAYOUT,
      }]
    case 'PRE':
      return [{
        style: 'codeBlock',
        table: { widths: ['*'], body: [[{ text: element.textContent.replace(/\n$/, ''), style: 'code' }]] },
        layout: CODE_LAYOUT,
      }]
    case 'HR':
      return [{
        margin: [0, 8, 0, 14],
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.6, lineColor: COLORS.border }],
      }]
    case 'TABLE': {
      const table = tableBlock(element, context)
      return table ? [table] : []
    }
    default:
      return blocksFor(element.childNodes, context)
  }
}

// Inline content between blocks, as in a list item without a paragraph, reads as a paragraph of its own.
const blocksFor = (nodes, context) => {
  const out = []
  let inline = []

  const flush = () => {
    if (inline.length) out.push(...paragraphBlocks(inline, context))
    inline = []
  }

  ;[...nodes].forEach((node) => {
    if (isElement(node) && SKIPPED.has(node.tagName)) return
    if (isBlock(node)) {
      flush()
      out.push(...elementBlocks(node, context))
    } else {
      inline.push(node)
    }
  })

  flush()
  return out
}

const parseBody = (html) => new window.DOMParser().parseFromString(`<body>${html ?? ''}</body>`, 'text/html').body

// The PDF sets the title itself, so a first heading that repeats it is dropped.
const withoutRepeatedTitle = (body, title) => {
  const first = body.firstElementChild
  if (title && first && /^H[1-6]$/.test(first.tagName) && flatten(first.textContent) === flatten(title)) first.remove()
  return body
}

export const htmlGuideDocDefinition = ({ title, html, figures }) => guideDocDefinition({
  title,
  content: blocksFor(withoutRepeatedTitle(parseBody(html), title).childNodes, { figures, tight: false }),
})

export const renderHtmlGuidePdf = async ({ title, html, figures }) => {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(htmlGuideDocDefinition({ title, html, figures })).getBlob()
}
