import { figureNames, htmlFigureNames } from './figureRefs'
import { applyFrontMatter, parseFrontMatter, serializeFrontMatter } from './frontMatter'
import { applyHtmlGuide, parseHtmlGuide, serializeHtmlGuide } from './htmlGuide'
import { HTML_KIND } from './helpNames'

const MARKDOWN = {
  parse: parseFrontMatter,
  serialize: serializeFrontMatter,
  apply: applyFrontMatter,
  figureNames,
  mime: 'text/markdown',
}

const HTML = {
  parse: parseHtmlGuide,
  serialize: serializeHtmlGuide,
  apply: applyHtmlGuide,
  figureNames: htmlFigureNames,
  mime: 'text/html',
}

/** How a guide of this kind is read and written: parse, serialize, apply, figureNames, mime. */
export const guideFormat = (kind) => (kind === HTML_KIND ? HTML : MARKDOWN)
