// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import * as libs from '../../../frontend/modules/richText.js'
import {
  imageReferences, imageSource, loadRichText, normalizeHref, renderRichText, resolvedImage, richTextExtensions,
} from '../../../frontend/components/RichTextEditor/richText'

vi.mock('../../../frontend/functions/modules', () => ({ loadModule: () => import('../../../frontend/modules/richText.js') }))

const view = (value) => {
  const div = document.createElement('div')
  div.append(renderRichText(value, libs))
  return div.innerHTML
}

const edited = (value) => {
  const editor = new libs.Editor({ extensions: richTextExtensions(libs), content: value })
  const html = editor.getHTML()
  editor.destroy()
  return html
}

describe('loadRichText', () => {
  it('resolves with the editor and its extensions', async () => {
    const module = await loadRichText()
    expect(typeof module.Editor).toBe('function')
    expect(module.StarterKit).toBeDefined()
  })
})

describe('renderRichText', () => {
  it('keeps the formatting the editor offers', () => {
    const value = '<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code></p>' +
      '<ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><hr>'
    expect(view(value)).toBe(value)
  })

  it('drops scripts, handlers, styles and unknown elements', () => {
    const html = view('<p style="color:red" onclick="alert(1)">a<script>alert(2)</script></p>' +
      '<img src="x.png" onerror="alert(3)"><iframe src="https://example.com"></iframe>')
    expect(html).toBe('<p>a</p><p><img src="x.png"></p>')
  })

  it('keeps a safe link and strips an unsafe one', () => {
    expect(view('<p><a href="https://example.com">ok</a></p>'))
      .toBe('<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">ok</a></p>')
    expect(view('<p><a href="javascript:alert(1)">bad</a></p>')).toBe('<p>bad</p>')
  })

  it('reads plain text as a paragraph and nothing as nothing', () => {
    expect(view('just text')).toBe('<p>just text</p>')
    expect(view('')).toBe('')
    expect(view(null)).toBe('')
  })

  it('shows what the editor would save', () => {
    const value = '<h3>H</h3><p>a <a href="https://example.com">link</a><span style="color:red">x</span></p>' +
      '<p><img src="figure.png" alt="f"></p><pre><code>code</code></pre><div>block</div>'
    expect(view(value)).toBe(edited(value))
  })
})

describe('normalizeHref', () => {
  it('adds https:// to a bare domain and mailto: to an address', () => {
    expect(normalizeHref(' example.com/path ')).toBe('https://example.com/path')
    expect(normalizeHref('someone@example.com')).toBe('mailto:someone@example.com')
  })

  it('leaves an address with a scheme, or a relative one, as given', () => {
    expect(normalizeHref('https://example.com')).toBe('https://example.com')
    expect(normalizeHref('mailto:a@b.mk')).toBe('mailto:a@b.mk')
    expect(normalizeHref('tel:+38970000000')).toBe('tel:+38970000000')
    expect(normalizeHref('/main/registry')).toBe('/main/registry')
    expect(normalizeHref('#section')).toBe('#section')
    expect(normalizeHref('')).toBe('')
    expect(normalizeHref(undefined)).toBe('')
  })
})

describe('images by name', () => {
  const resolve = (src) => ({ 'figure.png': 'blob:figure' })[src] ?? null

  it('shows a resolved name, hides an unknown one and leaves addresses alone', () => {
    expect(imageSource('figure.png', resolve)).toBe('blob:figure')
    expect(imageSource('missing.png', resolve)).toBeNull()
    expect(imageSource('https://example.com/a.png', resolve)).toBe('https://example.com/a.png')
    expect(imageSource('missing.png')).toBe('missing.png')
  })

  it('resolves in the view and marks what it cannot', () => {
    const div = document.createElement('div')
    div.append(renderRichText('<p><img src="figure.png" alt="f"><img src="gone.png"></p>', libs, resolve))
    expect(div.innerHTML).toBe('<p><img src="blob:figure" alt="f"><img data-rte-missing="gone.png"></p>')
  })

  it('keeps the name in the document while the editor shows the resolved image', () => {
    const resolveRef = { current: resolve }
    const redraws = new Set()
    const editor = new libs.Editor({
      extensions: richTextExtensions(libs, { image: resolvedImage(libs, resolveRef, redraws) }),
      content: '<p>a<img src="figure.png"></p><p><img src="later.png"></p>',
    })
    const shown = () => [...editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')].map(img => img.getAttribute('src'))
    expect(editor.getHTML()).toBe('<p>a<img src="figure.png"></p><p><img src="later.png"></p>')
    expect(shown()).toEqual(['blob:figure', null])
    resolveRef.current = (src) => `blob:${src}`
    redraws.forEach(draw => draw())
    expect(shown()).toEqual(['blob:figure.png', 'blob:later.png'])
    editor.destroy()
    expect(redraws.size).toBe(0)
  })

  it('lists the file names a document refers to', () => {
    expect([...imageReferences('<p><img src="a.png"><img src="https://x.mk/b.png"><img src="a.png"></p>')]).toEqual(['a.png'])
    expect(imageReferences('').size).toBe(0)
  })
})

describe('tables', () => {
  it('keeps a table through the editor and the view alike', () => {
    const value = '<table><tbody><tr><th><p>H</p></th></tr><tr><td colspan="2"><p>C</p></td></tr></tbody></table>'
    expect(view(value)).toBe(edited(value))
    expect(view(value)).toContain('<th><p>H</p></th>')
    expect(view(value)).toContain('<td colspan="2"><p>C</p></td>')
  })
})
