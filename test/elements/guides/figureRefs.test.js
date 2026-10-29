import { describe, expect, it } from 'vitest'
import { figureName, figureNames } from '../../../frontend/elements/guides/figureRefs'

describe('figureNames', () => {
  it('finds bare and angle-bracketed destinations, leaving titles out', () => {
    const markdown = [
      '![Search](search.png)',
      '![Result](<result screen.png>)',
      '![Map](map.png "The map")',
      '![Spaced]( spaced.png )'
    ].join('\n')
    expect(figureNames(markdown)).toEqual(['search.png', 'result screen.png', 'map.png', 'spaced.png'])
  })

  it('undoes percent escapes, so both spellings name one figure', () => {
    const markdown = '![a](%D1%81%D0%BD%D0%B8%D0%BC%D0%BA%D0%B0.png) ![b](снимка.png) ![c](my%20figure.png)'
    expect(figureNames(markdown)).toEqual(['снимка.png', 'my figure.png'])
  })

  it('keeps document order without repeats', () => {
    expect(figureNames('![](b.png) ![](a.png) ![](b.png)')).toEqual(['b.png', 'a.png'])
  })

  it('ignores links and raw img tags', () => {
    expect(figureNames('[a link](file.png) <img src="raw.png">')).toEqual([])
  })

  it('keeps a malformed escape as written', () => {
    expect(figureNames('![](bad%E0%A4.png)')).toEqual(['bad%E0%A4.png'])
  })

  it('reads nothing from no document', () => {
    expect(figureNames(null)).toEqual([])
    expect(figureNames('')).toEqual([])
  })
})

describe('figureName', () => {
  it('decodes one name the way figureNames does', () => {
    expect(figureName('my%20figure.png')).toBe('my figure.png')
    expect(figureName('100%.png')).toBe('100%.png')
  })
})
