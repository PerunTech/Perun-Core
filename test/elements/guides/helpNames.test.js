import { describe, expect, it, vi } from 'vitest'
import {
  DOC_KIND, HELP_DOC, HELP_IMAGE, HELP_PDF, PDF_KIND,
  buildDocName, buildImageName, buildPdfName, displayImageName, docStem, helpFileType, isFigureOfDoc,
  isPdfFile, kindExtension, mimeFromName, newestByName, parseDocName, resolveImageRecord
} from '../../../frontend/elements/guides/helpNames'

describe('parseDocName', () => {
  it('reads locale, slug and kind', () => {
    expect(parseDocName('en_US_searching-holdings.md')).toEqual({ locale: 'en_US', slug: 'searching-holdings', kind: DOC_KIND })
    expect(parseDocName('mk_MK_manual.pdf')).toEqual({ locale: 'mk_MK', slug: 'manual', kind: PDF_KIND })
    expect(parseDocName('en_US_a_b.md').slug).toBe('a_b')
  })

  it('refuses a name that does not follow the rule', () => {
    expect(parseDocName('searching-holdings.md')).toBeNull()
    expect(parseDocName('en_us_guide.md')).toBeNull()
    expect(parseDocName('en_US_guide.txt')).toBeNull()
    expect(parseDocName('en_US_.md')).toBeNull()
    expect(parseDocName(null)).toBeNull()
  })

  it('reads back what the builders write', () => {
    expect(parseDocName(buildDocName('en_US', 'guide'))).toEqual({ locale: 'en_US', slug: 'guide', kind: DOC_KIND })
    expect(parseDocName(buildPdfName('en_US', 'guide'))).toEqual({ locale: 'en_US', slug: 'guide', kind: PDF_KIND })
  })
})

describe('names', () => {
  it('kindExtension gives each kind its extension', () => {
    expect(kindExtension(PDF_KIND)).toBe('pdf')
    expect(kindExtension(DOC_KIND)).toBe('md')
  })

  it('docStem drops either extension, in any case', () => {
    expect(docStem('en_US_guide.md')).toBe('en_US_guide')
    expect(docStem('en_US_guide.PDF')).toBe('en_US_guide')
    expect(docStem(undefined)).toBe('')
  })

  it('buildImageName namespaces the upload and keeps slashes out', () => {
    expect(buildImageName('en_US_guide', ' sub/dir\\shot.png ')).toBe('en_US_guide__sub_dir_shot.png')
  })

  it('displayImageName recovers what the author wrote', () => {
    expect(displayImageName('en_US_guide__shot.png')).toBe('shot.png')
    expect(displayImageName('en_US_guide__a__b.png')).toBe('a__b.png')
    expect(displayImageName('plain.png')).toBe('plain.png')
  })

  it('isFigureOfDoc matches the stem exactly', () => {
    expect(isFigureOfDoc('en_US_guide__shot.png', 'en_US_guide')).toBe(true)
    expect(isFigureOfDoc('en_US_guide2__shot.png', 'en_US_guide')).toBe(false)
    expect(isFigureOfDoc(null, 'en_US_guide')).toBe(false)
  })
})

describe('helpFileType', () => {
  it('takes the declared FILE_TYPE when it is one of ours', () => {
    expect(helpFileType({ fileType: HELP_IMAGE, fileName: 'en_US_guide.md' })).toBe(HELP_IMAGE)
  })

  it('falls back on the name', () => {
    expect(helpFileType({ fileName: 'en_US_guide.md' })).toBe(HELP_DOC)
    expect(helpFileType({ fileName: 'en_US_guide.pdf' })).toBe(HELP_PDF)
    expect(helpFileType({ fileType: 'OTHER', fileName: 'en_US_guide__shot.png' })).toBe(HELP_IMAGE)
  })

  it('answers null for a file that is not ours', () => {
    expect(helpFileType({ fileType: 'ATTACHMENT', fileName: 'invoice.pdf' })).toBeNull()
    expect(helpFileType(null)).toBeNull()
  })
})

describe('mimeFromName', () => {
  it('maps the extension, in any case', () => {
    expect(mimeFromName('a.PNG')).toBe('image/png')
    expect(mimeFromName('a.jpeg')).toBe('image/jpeg')
    expect(mimeFromName('a.md')).toBe('text/markdown')
    expect(mimeFromName('a.pdf')).toBe('application/pdf')
  })

  it('falls back on octet-stream', () => {
    expect(mimeFromName('a.exe')).toBe('application/octet-stream')
    expect(mimeFromName('noextension')).toBe('application/octet-stream')
    expect(mimeFromName(null)).toBe('application/octet-stream')
  })
})

describe('isPdfFile', () => {
  const withMarkerAt = (at) => {
    const bytes = new Uint8Array(at + 8)
    bytes.set([0x25, 0x50, 0x44, 0x46], at)
    return new Blob([bytes])
  }

  it('finds the marker anywhere in the first kilobyte', async () => {
    expect(await isPdfFile(new Blob(['%PDF-1.7\n']))).toBe(true)
    expect(await isPdfFile(withMarkerAt(500))).toBe(true)
  })

  it('turns away a file without it, or with it too late', async () => {
    expect(await isPdfFile(new Blob(['PK\u0003\u0004 a spreadsheet renamed']))).toBe(false)
    expect(await isPdfFile(withMarkerAt(1024))).toBe(false)
    expect(await isPdfFile(null)).toBe(false)
  })

  it('answers false for a file that cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unreadable = { slice: () => ({ arrayBuffer: () => Promise.reject(new Error('gone')) }) }
    expect(await isPdfFile(unreadable)).toBe(false)
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

describe('newestByName', () => {
  it('keeps the newest row per name, by date and then by object id', () => {
    const records = [
      { fileName: 'a.md', fileDate: '2026-01-01', objectId: '9' },
      { fileName: 'a.md', fileDate: '2026-02-01', objectId: '1' },
      { fileName: 'b.md', fileDate: '2026-01-01', objectId: '2' },
      { fileName: 'b.md', fileDate: '2026-01-01', objectId: '10' },
      { fileName: 'c.md', objectId: '3' }
    ]
    expect(newestByName(records).map(record => [record.fileName, record.objectId])).toEqual([
      ['a.md', '1'], ['b.md', '10'], ['c.md', '3']
    ])
  })
})

describe('resolveImageRecord', () => {
  const images = [
    { fileName: 'en_US_guide__shot.png', objectId: 1 },
    { fileName: 'guide__shot.png', objectId: 2 },
    { fileName: 'guide__diagram.png', objectId: 3 },
    { fileName: 'logo.png', objectId: 4 }
  ]

  it("takes the document's own upload first", () => {
    expect(resolveImageRecord(images, 'en_US_guide', 'shot.png').objectId).toBe(1)
  })

  it('then the one every translation shares', () => {
    expect(resolveImageRecord(images, 'mk_MK_guide', 'shot.png').objectId).toBe(2)
    expect(resolveImageRecord(images, 'en_US_guide', 'diagram.png').objectId).toBe(3)
  })

  it('then the bare name', () => {
    expect(resolveImageRecord(images, 'en_US_guide', 'logo.png').objectId).toBe(4)
    expect(resolveImageRecord(images, 'en_US_guide', 'missing.png')).toBeNull()
  })
})
