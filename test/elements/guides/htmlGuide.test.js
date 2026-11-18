// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyHtmlGuide, parseHtmlGuide, serializeHtmlGuide } from '../../../frontend/elements/guides/htmlGuide'

const PAGE = [
  '<!doctype html>',
  '<html>',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Searching holdings</title>',
  '<meta name="route" content="/aims/holdings">',
  '<meta name="order" content="2">',
  '</head>',
  '<body>',
  '<h1>Holdings</h1><p>Some <strong>bold</strong>.</p>',
  '</body>',
  '</html>',
  ''
].join('\n')

describe('parseHtmlGuide', () => {
  it('reads the metadata out of the head and the body as the editor wrote it', () => {
    expect(parseHtmlGuide(PAGE)).toEqual({
      meta: { title: 'Searching holdings', route: '/aims/holdings', order: '2' },
      body: '<h1>Holdings</h1><p>Some <strong>bold</strong>.</p>'
    })
  })

  it('takes a fragment without a page around it as all body', () => {
    expect(parseHtmlGuide('  <p>Just this</p>\n')).toEqual({ meta: {}, body: '<p>Just this</p>' })
    expect(parseHtmlGuide(undefined)).toEqual({ meta: {}, body: '' })
  })

  it('leaves out a meta tag that is empty or not one of the keys', () => {
    const raw = '<html><head><meta name="route" content=" "><meta name="author" content="me"></head><body><p>x</p></body></html>'
    expect(parseHtmlGuide(raw)).toEqual({ meta: {}, body: '<p>x</p>' })
  })
})

describe('serializeHtmlGuide', () => {
  it('writes a whole page the parser reads back', () => {
    const meta = { title: 'Searching holdings', route: '/aims/holdings', order: 2 }
    const body = '<h1>Holdings</h1><p>Some <strong>bold</strong>.</p>'
    expect(serializeHtmlGuide(meta, body)).toBe(PAGE)
    expect(parseHtmlGuide(serializeHtmlGuide(meta, body))).toEqual({ meta: { ...meta, order: '2' }, body })
  })

  it('escapes the title and the attributes', () => {
    const page = serializeHtmlGuide({ title: 'Fish & <chips>', route: '/a?b="c"' }, '')
    expect(page).toContain('<title>Fish &amp; &lt;chips&gt;</title>')
    expect(page).toContain('<meta name="route" content="/a?b=&quot;c&quot;">')
    expect(parseHtmlGuide(page).meta).toEqual({ title: 'Fish & <chips>', route: '/a?b="c"' })
  })

  it('skips the keys without a value and keeps an empty title tag', () => {
    const page = serializeHtmlGuide({ route: '', order: null }, '  ')
    expect(page).toBe('<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title></title>\n</head>\n<body>\n</body>\n</html>\n')
    expect(parseHtmlGuide(page)).toEqual({ meta: { title: '' }, body: '' })
  })
})

describe('applyHtmlGuide', () => {
  it('changes the keys it is given and keeps the rest and the body', () => {
    expect(parseHtmlGuide(applyHtmlGuide(PAGE, { route: '/aims/search', title: 'Searching' }))).toEqual({
      meta: { title: 'Searching', route: '/aims/search', order: '2' },
      body: '<h1>Holdings</h1><p>Some <strong>bold</strong>.</p>'
    })
  })

  it('puts a page around a fragment', () => {
    expect(parseHtmlGuide(applyHtmlGuide('<p>x</p>', { route: '/r' }))).toEqual({ meta: { title: '', route: '/r' }, body: '<p>x</p>' })
  })
})
