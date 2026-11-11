// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  RICH_TEXT_DOC, RICH_TEXT_IMAGE, deleteRichTextDocument, listRichTextDocuments, loadRichTextDocument,
  saveRichTextDocument, uploadRichTextImage,
} from '../../../frontend/components/RichTextEditor/documentStore'
import { decodeNotes, encodeNotes } from '../../../frontend/functions/fileStore'
import { helpFileType } from '../../../frontend/elements/guides/helpNames'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const anchor = { objectId: 42, objectType: 'INSPECTION' }
const LIST = 'http://backend/ReactElements/getUploadedFiles/sid/session/object-id/42/object-type/INSPECTION/file-type/0'

const row = (id, fileName, fileType, fileDate = '2026-11-01', notes) =>
  ({ object_id: id, FILE_NAME: fileName, FILE_TYPE: fileType, FILE_DATE: fileDate, FILE_NOTES: notes && encodeNotes(notes) })

const ROWS = [
  row(1, 'report.html', RICH_TEXT_DOC, '2026-11-01', { title: 'Old' }),
  row(2, 'report.html', RICH_TEXT_DOC, '2026-11-05', { title: 'Report' }),
  row(3, 'report~chart.png', RICH_TEXT_IMAGE),
  row(4, 'letter.html', RICH_TEXT_DOC),
  row(5, 'letter~chart.png', RICH_TEXT_IMAGE),
  row(6, 'attachment.html', 'ATTACHMENT'),
  row(7, 'scan.pdf', 'ATTACHMENT'),
  row(8, 'en_US_report.md', 'HELP_DOC'),
  row(9, 'en_US_report__chart.png', 'HELP_IMAGE'),
  row(10, 'report__chart.png', 'HELP_IMAGE'),
]

beforeEach(() => {
  vi.stubGlobal('server', 'http://backend')
  axios.get.mockImplementation(async (url) => (url === LIST
    ? { data: { items: ROWS } }
    : { data: '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Report</title></head><body>\n<p>Stored <img src="chart.png"></p>\n</body></html>' }))
  axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  axios.get.mockReset()
  axios.post.mockReset()
})

describe('listRichTextDocuments', () => {
  it('lists the newest version of each document, and no other file on the object', async () => {
    const documents = await listRichTextDocuments('session', anchor)
    expect(documents.map(doc => [doc.name, doc.objectId, doc.notes.title])).toEqual([['report', 2, 'Report'], ['letter', 4, undefined]])
  })
})

describe('loadRichTextDocument', () => {
  it('reads the newest version, its body only, and its own images', async () => {
    const { record, html, images } = await loadRichTextDocument('session', anchor, 'report')
    expect(record.objectId).toBe(2)
    expect(axios.get).toHaveBeenLastCalledWith(
      'http://backend/ReactElements/downloadFile/sid/session/object-id/2/file-name/report.html', { responseType: 'blob' })
    expect(html).toBe('<p>Stored <img src="chart.png"></p>')
    expect(images.map(image => [image.image, image.objectId])).toEqual([['chart.png', 3]])
  })

  it('answers a document never saved with no record and no HTML', async () => {
    expect(await loadRichTextDocument('session', anchor, 'new-one')).toEqual({ record: null, html: '', images: [] })
  })

  it('refuses a name that would collide with the image names or the guides', async () => {
    await expect(loadRichTextDocument('session', anchor, 'a__b')).rejects.toThrow('cannot name a rich text document')
    await expect(loadRichTextDocument('session', anchor, 'a/b')).rejects.toThrow('cannot name a rich text document')
    await expect(loadRichTextDocument('session', anchor, 'a~b')).rejects.toThrow('cannot name a rich text document')
  })
})

describe('saving', () => {
  it('writes the document as a whole page under its own type and notes', async () => {
    await saveRichTextDocument('session', anchor, { name: 'report', html: '<p>New</p>', notes: { title: 'A & <B>' } })
    const [url, payload] = axios.post.mock.calls[0]
    const [prefix, note] = url.split('/note/')
    expect(prefix).toBe('http://backend/ReactElements/uploadFile/sid/session/object-id/42/object-type/INSPECTION/file-type/RICH_TEXT_DOC')
    expect(decodeNotes(note)).toEqual({ title: 'A & <B>' })
    const file = payload.get('file')
    expect([file.name, file.type]).toEqual(['report.html', 'text/html'])
    expect(await file.text()).toBe('<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>A &#38; &#60;B&#62;</title></head><body>\n<p>New</p>\n</body></html>\n')
  })

  it('stores an image under its document, under the file type given in place of the default', async () => {
    const image = new File(['x'], 'whatever.png', { type: 'image/png' })
    await uploadRichTextImage('session', { ...anchor, imageFileType: 'REPORT_IMAGE' }, { name: 'report', image: 'chart-2.png', file: image })
    const [url, payload] = axios.post.mock.calls[0]
    expect(url).toContain('/file-type/REPORT_IMAGE/note/')
    expect(payload.get('file').name).toBe('report~chart-2.png')
  })
})

describe('deleteRichTextDocument', () => {
  it('deletes every version and the images, and nothing of the other documents', async () => {
    expect(await deleteRichTextDocument('session', anchor, 'report')).toBe(3)
    const deleted = axios.post.mock.calls.map(([, body]) => JSON.parse(decodeURIComponent(body)).OBJECT_ID)
    expect(deleted).toEqual([1, 2, 3])
  })
})

describe('beside the user guides', () => {
  it('is never read as a guide or a guide figure, whatever type the row comes back with', () => {
    ['report.html', 'report~chart.png', 'en_US_report.html', 'en_US_report~shot.png'].forEach(fileName => {
      expect(helpFileType({ fileType: RICH_TEXT_DOC, fileName })).toBeNull()
      expect(helpFileType({ fileType: 'OTHER', fileName })).toBeNull()
      expect(helpFileType({ fileName })).toBeNull()
    })
  })
})
