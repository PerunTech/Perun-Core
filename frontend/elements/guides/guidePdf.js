import { figureNames } from './figureRefs'
import { loadMarkdown } from './renderMarkdown'
import { loadModule } from '../../functions/modules'

// Built from marked's tokens rather than rendered HTML, since pdfmake wants a document model. The
// lexer options match renderMarkdown's.

// A4 in points. Figures are given an explicit width, so the content width is needed here.
const PAGE_SIZE = 'A4'
const PAGE_MARGINS = [56, 56, 56, 62]
const CONTENT_WIDTH = 595.28 - PAGE_MARGINS[0] - PAGE_MARGINS[2]
// Leaves room for a caption under a full-height figure.
const MAX_FIGURE_HEIGHT = 620
const PX_TO_PT = 0.75

const COLORS = {
  text: '#1f2a2e',
  muted: '#6b787e',
  border: '#d9dee2',
  sunk: '#f4f5f6',
  accent: '#2f6d87',
  code: '#405a66',
}

// Roboto covers Cyrillic. Code is set in it too: the standard PDF monospaced faces are Latin-1 only.
const STYLES = {
  title: { fontSize: 20, bold: true, margin: [0, 0, 0, 16] },
  h1: { fontSize: 16, bold: true, margin: [0, 16, 0, 7] },
  h2: { fontSize: 14, bold: true, margin: [0, 14, 0, 6] },
  h3: { fontSize: 12.5, bold: true, margin: [0, 12, 0, 5] },
  h4: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
  h5: { fontSize: 10.5, bold: true, margin: [0, 10, 0, 4] },
  h6: { fontSize: 10.5, bold: true, color: COLORS.muted, margin: [0, 10, 0, 4] },
  paragraph: { margin: [0, 0, 0, 9] },
  paragraphTight: { margin: [0, 0, 0, 2] },
  caption: { fontSize: 9, italics: true, color: COLORS.muted, margin: [0, 0, 0, 14] },
  missing: { fontSize: 9.5, italics: true, color: COLORS.muted, margin: [0, 0, 0, 9] },
  code: { fontSize: 9, color: COLORS.code, preserveLeadingSpaces: true },
  codeBlock: { margin: [0, 2, 0, 11] },
  quote: { margin: [0, 2, 0, 11] },
  table: { margin: [0, 2, 0, 12], fontSize: 9.5 },
  list: { margin: [0, 0, 0, 9] },
}

const TABLE_LAYOUT = {
  // A full grid: without CSS behind it, a printed table needs its edges drawn.
  hLineWidth: (index, node) =>
    (index === 0 || index === node.table.body.length || index === node.table.headerRows ? 0.8 : 0.4),
  vLineWidth: (index, node) => (index === 0 || index === node.table.widths.length ? 0.8 : 0.4),
  hLineColor: () => COLORS.border,
  vLineColor: () => COLORS.border,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 5,
  paddingBottom: () => 5,
  fillColor: rowIndex => (rowIndex === 0 ? COLORS.sunk : null),
}

const CODE_LAYOUT = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 9,
  paddingRight: () => 9,
  paddingTop: () => 7,
  paddingBottom: () => 7,
  fillColor: () => COLORS.sunk,
}

const QUOTE_LAYOUT = {
  hLineWidth: () => 0,
  vLineWidth: index => (index === 0 ? 2.5 : 0),
  vLineColor: () => COLORS.accent,
  paddingLeft: () => 12,
  paddingRight: () => 0,
  paddingTop: () => 2,
  paddingBottom: () => 2,
}

const inlineRuns = (tokens, style = {}) => {
  const runs = []

  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'strong':
        runs.push(...inlineRuns(token.tokens, { ...style, bold: true }))
        break
      case 'em':
        runs.push(...inlineRuns(token.tokens, { ...style, italics: true }))
        break
      case 'del':
        runs.push(...inlineRuns(token.tokens, { ...style, decoration: 'lineThrough' }))
        break
      case 'link':
        runs.push(...inlineRuns(token.tokens, {
          ...style, color: COLORS.accent, decoration: 'underline', link: token.href,
        }))
        break
      case 'codespan':
        runs.push({ text: token.text, ...style, color: COLORS.code })
        break
      case 'br':
        runs.push({ text: '\n', ...style })
        break
      // The sanitizer drops raw HTML on every other surface.
      case 'html':
        break
      // paragraphBlocks lifts out a figure on its own line; one in a heading or a cell stands as its alt.
      case 'image':
        if (token.text) runs.push({ text: token.text, ...style, italics: true })
        break
      default:
        if (token.tokens?.length) runs.push(...inlineRuns(token.tokens, style))
        else if (token.text) runs.push({ text: token.text, ...style })
    }
  }

  return runs
}

// SVG stays vector. Rasters are scaled down to fit, never up.
const figureBlocks = (token, figures) => {
  const figure = figures?.[token.href]
  if (!figure) {
    return [{ text: `[${token.text || token.href}]`, style: 'missing' }]
  }

  const width = Math.round(Math.min(
    figure.width * PX_TO_PT,
    CONTENT_WIDTH,
    (MAX_FIGURE_HEIGHT * figure.width) / Math.max(figure.height, 1),
  ))

  const node = figure.kind === 'svg'
    ? { svg: figure.markup, width }
    : { image: figure.dataUri, width }
  node.margin = [0, 6, 0, token.text ? 5 : 14]

  return token.text ? [node, { text: token.text, style: 'caption' }] : [node]
}

// pdfmake has no inline image, so a figure splits its paragraph.
const paragraphBlocks = (tokens, figures, tight) => {
  const out = []
  let runs = []

  const flush = () => {
    if (runs.length) out.push({ text: runs, style: tight ? 'paragraphTight' : 'paragraph' })
    runs = []
  }

  for (const token of tokens ?? []) {
    if (token.type === 'image') {
      flush()
      out.push(...figureBlocks(token, figures))
      continue
    }
    runs.push(...inlineRuns([token]))
  }

  flush()
  return out
}

const listBlocks = (token, figures) => {
  const items = token.items.map((item) => {
    const parts = blocksFor(item.tokens, figures, !token.loose)
    // The checkbox joins the item's first line; as a block of its own it would sit above the item.
    if (item.task && Array.isArray(parts[0]?.text)) {
      parts[0].text.unshift({ text: item.checked ? '[x] ' : '[ ] ', color: COLORS.muted })
    }
    return parts.length === 1 ? parts[0] : { stack: parts }
  })

  const list = { style: 'list', markerColor: COLORS.muted }
  if (!token.ordered) return { ...list, ul: items }

  const start = Number(token.start)
  return { ...list, ol: items, ...(Number.isFinite(start) && start !== 1 ? { start } : {}) }
}

// Roughly one Roboto character at table size, plus cell padding. Only ranks columns and tells whether
// a table can fit; pdfmake does the fitting.
const TABLE_CHAR_WIDTH = 4.9
const CELL_PADDING = 18
// Longer than this, a column is prose and takes the room left over.
const WIDE_CELL = 28

const cellLength = (source) => {
  const text = inlineRuns(source.tokens).map(run => run.text).join('')
  return text.split('\n').reduce((longest, line) => Math.max(longest, line.length), 0)
}

// Value columns take what they need and prose columns share the rest, so a small table stays small and
// prose doesn't wrap beside empty columns. Even widths only when nothing else fits.
const columnWidths = (columns) => {
  const lengths = columns.map(cells => cells.reduce((longest, source) => Math.max(longest, cellLength(source)), 0))
  const estimate = lengths.reduce((total, length) => total + length * TABLE_CHAR_WIDTH + CELL_PADDING, 0)

  if (!lengths.some(length => length >= WIDE_CELL)) {
    return lengths.map(() => (estimate > CONTENT_WIDTH ? '*' : 'auto'))
  }
  return lengths.map(length => (length >= WIDE_CELL ? '*' : 'auto'))
}

const tableBlocks = (token) => {
  const cell = (source, header) => ({
    text: inlineRuns(source.tokens),
    alignment: source.align ?? undefined,
    bold: header || undefined,
  })

  const columns = token.header.map((head, index) =>
    [head, ...token.rows.map(row => row[index]).filter(Boolean)])

  return {
    style: 'table',
    table: {
      headerRows: 1,
      widths: columnWidths(columns),
      dontBreakRows: true,
      body: [
        token.header.map(source => cell(source, true)),
        ...token.rows.map(row => row.map(source => cell(source, false))),
      ],
    },
    layout: TABLE_LAYOUT,
  }
}

const HEADING_STYLES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// tight: inside a tight list, where a paragraph has no bottom margin.
const blocksFor = (tokens, figures, tight = false) => {
  const out = []

  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'heading':
        out.push({
          text: inlineRuns(token.tokens),
          style: HEADING_STYLES[Math.min(token.depth, 6) - 1],
        })
        break
      case 'paragraph':
      case 'text':
        out.push(...paragraphBlocks(token.tokens ?? [{ type: 'text', text: token.text }], figures, tight))
        break
      case 'code':
        out.push({
          style: 'codeBlock',
          table: { widths: ['*'], body: [[{ text: token.text, style: 'code' }]] },
          layout: CODE_LAYOUT,
        })
        break
      case 'blockquote':
        out.push({
          style: 'quote',
          table: { widths: ['*'], body: [[{ stack: blocksFor(token.tokens, figures) }]] },
          layout: QUOTE_LAYOUT,
        })
        break
      case 'list':
        out.push(listBlocks(token, figures))
        break
      case 'table':
        out.push(tableBlocks(token))
        break
      case 'hr':
        out.push({
          margin: [0, 8, 0, 14],
          canvas: [{
            type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.6, lineColor: COLORS.border,
          }],
        })
        break
      // space, def and raw html carry nothing to draw.
      default:
        break
    }
  }

  return out
}

const LEXER_OPTIONS = { gfm: true, breaks: false, async: false }

const flatten = (text) => (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

// The PDF sets the title itself, so a first heading that repeats it is dropped.
const withoutRepeatedTitle = (tokens, title) => {
  if (!title) return tokens
  const first = tokens.findIndex(token => token.type !== 'space')
  const opening = tokens[first]
  if (opening?.type !== 'heading' || flatten(opening.text) !== flatten(title)) return tokens
  return tokens.filter((_, index) => index !== first)
}

const guideDocDefinition = ({ title, tokens, figures }) => ({
  info: { title: title || 'Guide' },
  pageSize: PAGE_SIZE,
  pageMargins: PAGE_MARGINS,
  defaultStyle: { fontSize: 10.5, lineHeight: 1.35, color: COLORS.text },
  styles: STYLES,
  content: [
    ...(title ? [{ text: title, style: 'title' }] : []),
    ...blocksFor(withoutRepeatedTitle(tokens, title), figures),
  ],
  footer: (page, pages) => ({
    margin: [PAGE_MARGINS[0], 12, PAGE_MARGINS[2], 0],
    columns: [
      { text: title ?? '', fontSize: 8, color: COLORS.muted },
      { text: `${page} / ${pages}`, fontSize: 8, color: COLORS.muted, alignment: 'right' },
    ],
  }),
})

// pdfkit embeds only PNG and JPEG, so other rasters are redrawn as PNG. SVG is embedded as is.
const EMBEDDABLE = new Set(['image/png', 'image/jpeg'])
const SVG_TYPE = 'image/svg+xml'

const toDataUri = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

const measure = (source) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('The figure could not be decoded'))
  image.src = source
})

const toPng = (image) => {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  canvas.getContext('2d').drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

// viewBox first, since width and height are as often percentages. Only the ratio matters.
const svgSize = (markup) => {
  const box = /viewBox\s*=\s*["']([^"']+)["']/i.exec(markup)
  const numbers = box ? box[1].trim().split(/[\s,]+/).map(Number) : []
  if (numbers.length === 4 && numbers.slice(2).every(value => Number.isFinite(value) && value > 0)) {
    return { width: numbers[2], height: numbers[3] }
  }

  const width = /\bwidth\s*=\s*["']([\d.]+)/i.exec(markup)
  const height = /\bheight\s*=\s*["']([\d.]+)/i.exec(markup)
  if (width && height) return { width: Number(width[1]), height: Number(height[1]) }

  return { width: 480, height: 320 }
}

const prepareFigure = async (url) => {
  const blob = await (await fetch(url)).blob()

  if (blob.type === SVG_TYPE) {
    const markup = await blob.text()
    return { kind: 'svg', markup, ...svgSize(markup) }
  }

  const dataUri = await toDataUri(blob)
  const image = await measure(dataUri)
  return {
    kind: 'image',
    dataUri: EMBEDDABLE.has(blob.type) ? dataUri : toPng(image),
    width: image.naturalWidth,
    height: image.naturalHeight,
  }
}

// Read back through the figures' own URLs, so an unsaved draft exports as it previews. A figure that
// can't be read is left out rather than failing the export.
export const loadPdfFigures = async (body, resolveUrl) => {
  const names = figureNames(body)
  if (!names.length || !resolveUrl) return {}

  const pairs = await Promise.all(names.map(async (name) => {
    try {
      const url = resolveUrl(name)
      return [name, url ? await prepareFigure(url) : null]
    } catch (err) {
      console.error(`Could not read the figure ${name}`, err)
      return [name, null]
    }
  }))

  return Object.fromEntries(pairs.filter(([, figure]) => figure))
}

const loadPdfMake = () => loadModule('pdfmake').then((module) => module.default)

export const renderGuidePdf = async ({ title, body, figures }) => {
  const [pdfMake, { marked }] = await Promise.all([loadPdfMake(), loadMarkdown()])
  const tokens = marked.lexer(body ?? '', LEXER_OPTIONS)
  return pdfMake.createPdf(guideDocDefinition({ title, tokens, figures })).getBlob()
}
