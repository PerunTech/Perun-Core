import { marked } from 'marked'

import { figureNames } from './figureRefs'
import { loadModule } from '../../functions/modules'

/**
 * Renders one guide as a PDF, from the same Markdown the reader is shown.
 *
 * Markdown carries no binary, so a downloaded .md either points at figures that are not beside it
 * or inlines them as data: URIs that a good half of the Markdown viewers in use refuse to draw.
 * A PDF has no such problem: this is the form a manual is read and kept in, and the .zip beside it
 * in the interface is the form it is edited and moved in.
 *
 * The document is built from marked's own token stream rather than from rendered HTML, because
 * pdfmake wants a document model and not markup: converting through HTML would mean parsing it back
 * out again. The lexer options match the ones renderMarkdown passes, so the page and the PDF are
 * reading the same document.
 */

// A4 in points, which is what pdfmake measures in. The content width is what a figure or a table
// has to fit, and is needed here rather than left to pdfmake because an image is given an explicit
// width: scaling one to fill the measure regardless of its own size would blow up a small figure.
const PAGE_SIZE = 'A4'
const PAGE_MARGINS = [56, 56, 56, 62]
const CONTENT_WIDTH = 595.28 - PAGE_MARGINS[0] - PAGE_MARGINS[2]
// Leaves room under a full-height figure for its caption, and keeps one from being the only thing
// on a page it does not fill.
const MAX_FIGURE_HEIGHT = 620
// CSS pixels to points. A figure authored at screen resolution lands at its natural reading size.
const PX_TO_PT = 0.75

const COLORS = {
  text: '#1f2a2e',
  muted: '#6b787e',
  border: '#d9dee2',
  sunk: '#f4f5f6',
  accent: '#2f6d87',
  code: '#405a66',
}

// Roboto is the only family pdfmake carries, and it covers Latin and Cyrillic alike, so a
// Macedonian guide sets as readily as an English one. Code is set in it too rather than in one of
// the standard PDF monospaced faces, which are Latin-1 only and would drop a Cyrillic comment.
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
  // A full grid, outer box included: the ruled-lines-only look a browser gives a Markdown table
  // reads fine with CSS backing it, but alone on a printed page a table needs its edges stated.
  hLineWidth: (index, node) =>
    (index === 0 || index === node.table.body.length || index === node.table.headerRows ? 0.8 : 0.4),
  vLineWidth: (index, node) => (index === 0 || index === node.table.widths.length ? 0.8 : 0.4),
  hLineColor: () => COLORS.border,
  vLineColor: () => COLORS.border,
  // Symmetric now that a border sits on both edges, rather than the flush-left padding a
  // rules-only table used to line its first column up with the paragraph above it.
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

// A rule down the left edge and nothing else, which is the quote mark every other surface uses.
const QUOTE_LAYOUT = {
  hLineWidth: () => 0,
  vLineWidth: index => (index === 0 ? 2.5 : 0),
  vLineColor: () => COLORS.accent,
  paddingLeft: () => 12,
  paddingRight: () => 0,
  paddingTop: () => 2,
  paddingBottom: () => 2,
}

/* ----------------------------------------------------------------- inline -- */

/**
 * One Markdown inline token stream as pdfmake text runs.
 *
 * The style travels down rather than being resolved per token, which is what makes a link inside
 * bold inside a list item come out as all three at once.
 */
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
      // Raw HTML is stripped by the sanitizer on every other surface, so it is dropped here too
      // rather than printed as its own source.
      case 'html':
        break
      // A figure on its own line is lifted out by paragraphBlocks before it reaches here. One that
      // is not, in a heading or a table cell, has nowhere to be drawn, so it stands as its alt text.
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

/* ---------------------------------------------------------------- figures -- */

/**
 * One figure as the node that draws it, plus its caption.
 *
 * An SVG stays vector, which is the whole reason to have drawn a diagram as one. Everything else
 * arrives as a data URI with its natural size already measured, and is scaled down to fit the
 * measure and the page but never scaled up: a 48px icon blown across the page would be a worse
 * answer than a small icon.
 */
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

/* ----------------------------------------------------------------- blocks -- */

/**
 * A paragraph, split around any figure it carries.
 *
 * pdfmake has no inline image, so a figure interrupts its paragraph instead of sitting inside it.
 * The usual case, a figure alone on its own line, comes out of that as exactly one image block.
 */
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
    // A checklist keeps its boxes, since that is usually why one was written. The box joins the
    // item's own first line: as a block of its own it would stand on the line above the item.
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

// Roughly the advance width of one character of Roboto at the size a table is set in, plus what the
// layout above puts either side of a cell. Only ever used to rank columns against each other and to
// tell a table that can fit the measure from one that cannot; the fitting itself is pdfmake's work.
const TABLE_CHAR_WIDTH = 4.9
const CELL_PADDING = 18
// Past this a column is prose rather than a value, and is the one that should take the room a table
// has left over.
const WIDE_CELL = 28

/** The longest rendered line in a cell, which is the width the cell would rather have. */
const cellLength = (source) => {
  const text = inlineRuns(source.tokens).map(run => run.text).join('')
  return text.split('\n').reduce((longest, line) => Math.max(longest, line.length), 0)
}

/**
 * How wide each column should be.
 *
 * Even columns are what a document model gives you if you do not ask, and they are wrong in both
 * directions: a description column wraps to five lines while the code column beside it sits empty,
 * and a table of three short values is stretched across the whole measure with gaps in it.
 *
 * So the columns are sorted into two kinds. A column of values is measured by pdfmake and takes
 * exactly the room its content needs, which is what lets a small table stay small. A column of
 * prose is starred and takes what is left over, which is what stops it wrapping while its
 * neighbours stand empty. Only when a table has no prose column and still cannot fit does it fall
 * back to even columns, because at that point nothing else fits either.
 */
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

/**
 * Block tokens as pdfmake content.
 *
 * @param {object[]} tokens  from marked's lexer
 * @param {object} figures   figure name to a prepared figure, from loadPdfFigures
 * @param {boolean} tight    inside a tight list, where a paragraph carries no bottom margin
 */
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

/* ------------------------------------------------------------- definition -- */

const LEXER_OPTIONS = { gfm: true, breaks: false, async: false }

const flatten = (text) => (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Drops the body's opening heading when it only restates the guide's title.
 *
 * A guide is stored with its title in the front matter and is as often written with that same title
 * as its first heading, which the reader never shows twice because the title lives in the panel's
 * own chrome. The PDF has no chrome, so the title is set on the page here, and the heading that
 * would follow it word for word is the one to give up.
 */
const withoutRepeatedTitle = (tokens, title) => {
  if (!title) return tokens
  const first = tokens.findIndex(token => token.type !== 'space')
  const opening = tokens[first]
  if (opening?.type !== 'heading' || flatten(opening.text) !== flatten(title)) return tokens
  return tokens.filter((_, index) => index !== first)
}

/**
 * The pdfmake document for one guide. Pure, so it can be checked without a browser or a renderer.
 *
 * @param {string} title    the guide's own title, for the first page and the running footer
 * @param {string} body     Markdown, front matter already removed
 * @param {object} figures  figure name to a prepared figure, from loadPdfFigures
 */
const guideDocDefinition = ({ title, body, figures }) => ({
  info: { title: title || 'Guide' },
  pageSize: PAGE_SIZE,
  pageMargins: PAGE_MARGINS,
  defaultStyle: { fontSize: 10.5, lineHeight: 1.35, color: COLORS.text },
  styles: STYLES,
  content: [
    ...(title ? [{ text: title, style: 'title' }] : []),
    ...blocksFor(withoutRepeatedTitle(marked.lexer(body ?? '', LEXER_OPTIONS), title), figures),
  ],
  footer: (page, pages) => ({
    margin: [PAGE_MARGINS[0], 12, PAGE_MARGINS[2], 0],
    columns: [
      { text: title ?? '', fontSize: 8, color: COLORS.muted },
      { text: `${page} / ${pages}`, fontSize: 8, color: COLORS.muted, alignment: 'right' },
    ],
  }),
})

/* ------------------------------------------------------------------ fetch -- */

// pdfkit embeds PNG and JPEG and nothing else, so a figure in any other raster format is redrawn
// as a PNG on the way past. SVG skips all of this and is embedded as the vector it is.
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

/**
 * The size an SVG asks to be drawn at.
 *
 * The viewBox is read first because it is the one an authoring tool always writes, and the width
 * and height attributes are as often a percentage as a length. Only the ratio matters downstream,
 * so the fallback only has to be a sane one.
 */
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

/**
 * Reads every figure a document references into the form the PDF needs.
 *
 * Figures are read back through their own URLs rather than refetched from the store, which is what
 * lets one function serve every caller: the reader holds object URLs for a stored document, and the
 * editor holds them for figures dropped in this session and not yet uploaded, so a draft exports
 * exactly as it previews.
 *
 * A figure that cannot be read is left out rather than failing the export. The document is still
 * worth having, and its place in the PDF says which figure is missing.
 *
 * @param {string} body  Markdown, front matter already removed
 * @param {(name: string) => string|null} resolveUrl  figure name to a URL this document can fetch
 */
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

/* ----------------------------------------------------------------- render -- */

/**
 * pdfmake and its fonts, loaded on demand.
 *
 * Both are large and neither is wanted until somebody exports, so they are a module of their own
 * beside the bundle (frontend/modules/pdfmake.js) and fetched at that point, the same way the icon
 * set is. The loader keeps the module, so a second export pays nothing, and forgets a failed load,
 * so the next export retries rather than finding the feature pinned shut.
 */
const loadPdfMake = () => loadModule('pdfmake').then((module) => module.default)

/** Renders one guide to a PDF blob, ready to download. */
export const renderGuidePdf = async ({ title, body, figures }) => {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(guideDocDefinition({ title, body, figures })).getBlob()
}
