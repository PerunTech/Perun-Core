import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  ALL_FILE_TYPES, listHelpFiles, readItems, readObjectId, readValue, requireResponse
} from '../../../frontend/elements/guides/helpApi'
import { encodeNotes } from '../../../frontend/elements/guides/helpNotes'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))

describe('requireResponse', () => {
  it('passes a response through, an empty one included', () => {
    const empty = { data: {} }
    expect(requireResponse(empty)).toBe(empty)
  })

  it('throws when there is no response, as after a 401 the interceptor resolved', () => {
    expect(() => requireResponse(undefined)).toThrow('The request did not complete')
    expect(() => requireResponse(null)).toThrow('The request did not complete')
  })
})

describe('readItems', () => {
  it('reads every shape the listing has come in', () => {
    expect(readItems([1])).toEqual([1])
    expect(readItems({ items: [1] })).toEqual([1])
    expect(readItems({ data: [1] })).toEqual([1])
    expect(readItems({ data: { items: [1] } })).toEqual([1])
    expect(readItems({ data: { data: [1] } })).toEqual([1])
  })

  it('reads an empty result, and anything it does not know, as no rows', () => {
    expect(readItems({ data: {} })).toEqual([])
    expect(readItems({})).toEqual([])
    expect(readItems(undefined)).toEqual([])
  })
})

describe('readValue and readObjectId', () => {
  it('take a nested values object first, then the flat field', () => {
    expect(readValue({ values: { FILE_NAME: 'a' }, FILE_NAME: 'b' }, 'FILE_NAME')).toBe('a')
    expect(readValue({ FILE_NAME: 'b' }, 'FILE_NAME')).toBe('b')
    expect(readValue({}, 'FILE_NAME')).toBeNull()
    expect(readValue(null, 'FILE_NAME')).toBeNull()
  })

  it('find the object id under any of its spellings', () => {
    expect(readObjectId({ object_id: 1 })).toBe(1)
    expect(readObjectId({ objectId: 2 })).toBe(2)
    expect(readObjectId({ OBJECT_ID: 3 })).toBe(3)
    expect(readObjectId({ values: { OBJECT_ID: 4 } })).toBe(4)
    expect(readObjectId({})).toBeNull()
  })
})

describe('listHelpFiles', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { server: 'http://backend' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    axios.get.mockReset()
  })

  it('asks for every file on the plugin row', async () => {
    axios.get.mockResolvedValue({ data: {} })
    await listHelpFiles('session', 42, ALL_FILE_TYPES)
    expect(axios.get).toHaveBeenCalledWith(
      'http://backend/ReactElements/getUploadedFiles/sid/session/object-id/42/object-type/SVAROG_PERUN_PLUGIN/file-type/0'
    )
  })

  it('reads an empty result as no files', async () => {
    axios.get.mockResolvedValue({ data: {} })
    expect(await listHelpFiles('session', 42, ALL_FILE_TYPES)).toEqual([])
  })

  it('throws rather than reading an expired session as no files', async () => {
    axios.get.mockResolvedValue(undefined)
    await expect(listHelpFiles('session', 42, ALL_FILE_TYPES)).rejects.toThrow('The request did not complete')
  })

  it('turns each row into a record and drops rows without an id or a name', async () => {
    axios.get.mockResolvedValue({
      data: {
        items: [
          {
            object_id: 7,
            FILE_NAME: 'en_US_guide.md',
            FILE_TYPE: 'HELP_DOC',
            FILE_SIZE: 120,
            FILE_DATE: '2026-10-01',
            CONTENT_TYPE: null,
            FILE_NOTES: encodeNotes({ route: '/aims/holdings' })
          },
          { object_id: 8, FILE_NAME: 'en_US_guide__shot.png', FILE_TYPE: 'HELP_IMAGE' },
          { FILE_NAME: 'no-id.md' },
          { object_id: 9 }
        ]
      }
    })

    const records = await listHelpFiles('session', 42, ALL_FILE_TYPES)

    expect(records).toEqual([
      {
        objectId: 7,
        fileName: 'en_US_guide.md',
        fileType: 'HELP_DOC',
        fileSize: 120,
        fileDate: '2026-10-01',
        contentType: 'text/markdown',
        notes: { route: '/aims/holdings' },
        locale: 'en_US',
        slug: 'guide',
        kind: 'markdown'
      },
      {
        objectId: 8,
        fileName: 'en_US_guide__shot.png',
        fileType: 'HELP_IMAGE',
        fileSize: null,
        fileDate: null,
        contentType: 'image/png',
        notes: {},
        locale: null,
        slug: null,
        kind: null
      }
    ])
  })
})
