import { describe, expect, it } from 'vitest'
import { figureNames, htmlFigureNames } from '../../../frontend/elements/guides/figureRefs'
import { parseFrontMatter } from '../../../frontend/elements/guides/frontMatter'
import { guideFormat } from '../../../frontend/elements/guides/guideFormat'
import { DOC_KIND, HTML_KIND } from '../../../frontend/elements/guides/helpNames'
import { parseHtmlGuide } from '../../../frontend/elements/guides/htmlGuide'

describe('guideFormat', () => {
  it('reads and writes a rich text guide as HTML', () => {
    const format = guideFormat(HTML_KIND)
    expect(format.parse).toBe(parseHtmlGuide)
    expect(format.figureNames).toBe(htmlFigureNames)
    expect(format.mime).toBe('text/html')
  })

  it('takes any other kind as Markdown', () => {
    for (const kind of [DOC_KIND, undefined]) {
      expect(guideFormat(kind).parse).toBe(parseFrontMatter)
      expect(guideFormat(kind).figureNames).toBe(figureNames)
      expect(guideFormat(kind).mime).toBe('text/markdown')
    }
  })
})
