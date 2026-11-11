// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import * as libs from '../../../frontend/modules/richText.js'
import { cleanPastedHtml, isWordHtml, rtfImages } from '../../../frontend/components/RichTextEditor/pastedHtml'
import { renderRichText } from '../../../frontend/components/RichTextEditor/richText'

vi.mock('../../../frontend/functions/modules', () => ({ loadModule: () => import('../../../frontend/modules/richText.js') }))

const marker = (text, font = 'Symbol') =>
  `<![if !supportLists]><span style='font-family:${font}'><span style='mso-list:Ignore'>${text}` +
  `<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>`

const item = (list, level, text, mark) =>
  `<p class=MsoListParagraphCxSpMiddle style='margin-left:.5in;text-indent:-.25in;mso-list:${list} level${level} lfo1'>${mark}${text}<o:p></o:p></p>`

const LOCAL_IMAGE = 'file:///C:/Users/me/AppData/Local/Temp/msohtmlclip1/01/clip_image002.png'

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta name=ProgId content=Word.Document><style><!-- p.MsoNormal {margin:0in;} --></style></head>
<body lang=EN-US><!--StartFragment-->
<h1>Inspection report<o:p></o:p></h1>
<p class=MsoNormal>Some <b>bold</b> and <i>italic</i> text.<o:p></o:p></p>
${item('l0', 1, 'First', marker('·'))}
${item('l0', 2, 'Nested', marker('o', 'Courier New'))}
${item('l0', 1, 'Second', marker('·'))}
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
${item('l1', 1, 'One', marker('1.', 'Calibri'))}
${item('l1', 1, 'Two', marker('2.', 'Calibri'))}
<p class=MsoNormal><!--[if gte vml 1]><v:shape id="Picture_x0020_1"><v:imagedata src="${LOCAL_IMAGE}"/></v:shape><![endif]--><![if !vml]><img width=100 height=50 src="${LOCAL_IMAGE}" v:shapes="Picture_x0020_1"><![endif]><o:p></o:p></p>
<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse'>
 <tr><td width=312 valign=top style='width:233.75pt'><p class=MsoNormal>A<o:p></o:p></p></td>
 <td width=312 valign=top style='width:233.75pt'><p class=MsoNormal>B<o:p></o:p></p></td></tr>
</table>
<!--EndFragment--></body></html>`

const PNG_HEX = '89504e470d0a1a0a0000000d49484452'
const RTF = '{\\rtf1\\ansi{\\*\\shppict{\\pict{\\*\\picprop{\\sp{\\sn shapeType}{\\sv 75}}}' +
  '\\picscalex100\\picw2646\\pich1323\\pngblip\\bliptag-1734080161{\\*\\blipuid 98a3e8df0f6a7d1c}' +
  `${PNG_HEX.slice(0, 16)}\r\n${PNG_HEX.slice(16)}}}` +
  '{\\nonshppict{\\pict\\picscalex100\\picw2646\\pich1323\\wmetafile8\\bliptag-1734080161 0100090000037c}}}'

const shown = (html) => {
  const div = document.createElement('div')
  div.append(renderRichText(html, libs))
  return div.innerHTML
}

describe('isWordHtml', () => {
  it('knows Word by its namespaces, classes and styles', () => {
    expect(isWordHtml(WORD)).toBe(true)
    expect(isWordHtml("<p style='mso-list:l0 level1'>x</p>")).toBe(true)
    expect(isWordHtml('<p>Plain <b>HTML</b></p>')).toBe(false)
    expect(isWordHtml(null)).toBe(false)
  })
})

describe('rtfImages', () => {
  it('reads the PNG out of the shape picture and skips its metafile copy', () => {
    const images = rtfImages(RTF)
    expect(images).toHaveLength(1)
    expect(images[0].type).toBe('image/png')
    expect(Buffer.from(images[0].bytes).toString('hex')).toBe(PNG_HEX)
  })

  it('reads JPEG pictures and nothing from no RTF', () => {
    expect(rtfImages('{\\pict\\jpegblip\\bliptag5 ffd8ffe000104a46}')[0]).toEqual({
      type: 'image/jpeg', bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
    })
    expect(rtfImages(null)).toEqual([])
    expect(rtfImages('{\\rtf1 no pictures}')).toEqual([])
  })
})

describe('cleanPastedHtml', () => {
  it('turns Word paragraphs into the lists, tables and marks the editor keeps', () => {
    const { html, dropped } = cleanPastedHtml(WORD, { rtf: RTF, keepImage: () => 'kept.png' })
    expect(dropped).toBe(0)
    expect(html).not.toMatch(/o:p|mso-list|StartFragment|·/)
    expect(shown(html)).toBe(
      '<h1>Inspection report</h1><p>Some <strong>bold</strong> and <em>italic</em> text.</p>' +
      '<ul><li><p>First</p><ul><li><p>Nested</p></li></ul></li><li><p>Second</p></li></ul>' +
      '<p></p><ol><li><p>One</p></li><li><p>Two</p></li></ol>' +
      '<p><img src="kept.png" width="100" height="50"></p>' +
      '<table style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup>' +
      '<tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>'
    )
  })

  it('hands a Word image to keepImage as the file the RTF carries', () => {
    const keepImage = vi.fn(() => 'blob:kept')
    cleanPastedHtml(WORD, { rtf: RTF, keepImage })
    expect(keepImage).toHaveBeenCalledTimes(1)
    const [file] = keepImage.mock.calls[0]
    expect(file).toBeInstanceOf(File)
    expect([file.name, file.type, file.size]).toEqual(['pasted-1.png', 'image/png', PNG_HEX.length / 2])
  })

  it('leaves out Word images it cannot match, and says how many', () => {
    const keepImage = vi.fn(() => 'kept.png')
    const noRtf = cleanPastedHtml(WORD, { keepImage })
    expect(noRtf.dropped).toBe(1)
    expect(noRtf.html).not.toContain('<img')
    expect(keepImage).not.toHaveBeenCalled()
    expect(cleanPastedHtml(WORD, { rtf: RTF }).dropped).toBe(1)
  })

  it('stores data: images as files, from any source', () => {
    const keepImage = vi.fn(() => 'stored.gif')
    const pixel = 'R0lGODlhAQABAAAAACw='
    const { html, dropped } = cleanPastedHtml(`<p>x<img src="data:image/gif;base64,${pixel}" alt="dot"></p>`, { keepImage })
    expect([html, dropped]).toEqual(['<p>x<img src="stored.gif" alt="dot"></p>', 0])
    expect(keepImage.mock.calls[0][0].type).toBe('image/gif')
    expect(cleanPastedHtml(`<p><img src="data:image/gif;base64,${pixel}"></p>`).dropped).toBe(1)
  })

  it('passes other HTML through untouched', () => {
    const html = '<p>From <b>a page</b><img src="https://example.com/a.png"></p>'
    expect(cleanPastedHtml(html)).toEqual({ html, dropped: 0 })
  })
})
