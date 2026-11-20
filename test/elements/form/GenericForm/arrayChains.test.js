// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  arrive, cleanUpEach, data, find, findAll, labChain, labRequest, mountForm, options, pick, requested, select,
  serveCodelists, settle, until
} from './harness.js'

describe('GenericForm DependencyDropdown in an array item', { timeout: 15000 }, () => {
  cleanUpEach()
  let get

  beforeEach(() => {
    get = serveCodelists({
      roots: { LABS: ['L1', 'L2'], FOOD_SAMPLE_TYPE: ['T1'] },
      levels: { LAB_DEPT: { L1: ['D1'], L2: ['D2'] }, SAMPLE_SUBTYPE: ['S1'] }
    })
  })

  async function load (id, method, uiSchema, record) {
    mountForm({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: record })
    await until(() => expect(find('.array-item-add button')).not.toBeNull())
  }

  async function add (arrayId, firstSelect) {
    find(`[id="${arrayId}"] .array-item-add button`).click()
    await until(() => expect(select(firstSelect)).not.toBeNull())
  }

  it('keeps working in an array at the root of the schema', async () => {
    await load('ROOT_ARRAY_FORM', { type: 'array', items: labRequest }, { items: labChain }, [])
    await add('root', 'root_0_LAB_OBJ_ID')
    pick('root_0_LAB_OBJ_ID', 'L1')

    await until(() => expect(select('root_0_DEPARTMENT')).not.toBeNull())
    expect(data('ROOT_ARRAY_FORM')[0].LAB_OBJ_ID).toBe('L1')
  })

  it('draws, fills and chains in an array inside the form, row by row', async () => {
    const method = { type: 'object', properties: { NOTE: { type: 'string' }, LAB_REQUEST: { type: 'array', items: labRequest } } }
    await load('NESTED_ARRAY_FORM', method, { LAB_REQUEST: { items: labChain } }, { NOTE: 'kept' })
    await add('root_LAB_REQUEST', 'root_LAB_REQUEST_0_LAB_OBJ_ID')
    expect(requested(get).some((url) => url.includes('LABS'))).toBe(true)

    pick('root_LAB_REQUEST_0_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_LAB_REQUEST_0_DEPARTMENT')).not.toBeNull())
    expect(data('NESTED_ARRAY_FORM').NOTE).toBe('kept')
    expect(data('NESTED_ARRAY_FORM').LAB_REQUEST[0].LAB_OBJ_ID).toBe('L1')

    await add('root_LAB_REQUEST', 'root_LAB_REQUEST_1_LAB_OBJ_ID')
    pick('root_LAB_REQUEST_1_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')).not.toBeNull())
    expect(data('NESTED_ARRAY_FORM').LAB_REQUEST.map(row => row.LAB_OBJ_ID)).toEqual(['L1', 'L1'])
  })

  it('uses its own field and codelist in a section of an array item, beside another array', async () => {
    const method = {
      type: 'object',
      properties: {
        LAB_REQUEST: { type: 'array', items: labRequest },
        SAMPLE: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              'SAMPLE.basic_info': { type: 'object', properties: { SAMPLE_TYPE: { type: 'string', title: 'Type' }, SAMPLE_SUBTYPE: { type: 'string', title: 'Subtype' } } }
            }
          }
        }
      }
    }
    const uiSchema = {
      LAB_REQUEST: { items: labChain },
      SAMPLE: {
        items: {
          'SAMPLE.basic_info': {
            SAMPLE_TYPE: { 'ui:widget': 'DependencyDropdown', codelistName: 'FOOD_SAMPLE_TYPE', order: 0 },
            SAMPLE_SUBTYPE: { 'ui:widget': 'hidden', dependentOnField: 'SAMPLE_TYPE', codelistName: 'SAMPLE_SUBTYPE', order: 1 }
          }
        }
      }
    }
    await load('SECTION_IN_ITEM_FORM', method, uiSchema, {})
    await add('root_SAMPLE', 'root_SAMPLE_0_SAMPLE.basic_info_SAMPLE_TYPE')
    expect(requested(get).filter(url => url.includes('LABS'))).toEqual([])
    expect(requested(get).some((url) => url.includes('FOOD_SAMPLE_TYPE'))).toBe(true)

    pick('root_SAMPLE_0_SAMPLE.basic_info_SAMPLE_TYPE', 'T1')
    await until(() => expect(select('root_SAMPLE_0_SAMPLE.basic_info_SAMPLE_SUBTYPE')).not.toBeNull())
    expect(data('SECTION_IN_ITEM_FORM').SAMPLE[0]['SAMPLE.basic_info'].SAMPLE_TYPE).toBe('T1')
  })

  // The removed row's chain clears its values a tick after it unmounts, hence the settle() after a removal
  const namedRequest = { ...labRequest, properties: { NAME: { type: 'string' }, ...labRequest.properties } }
  const namedMethod = { type: 'object', properties: { LAB_REQUEST: { type: 'array', items: namedRequest } } }

  it('keeps the values of the row that moves up when the row above it is removed', async () => {
    const rows = [{ NAME: 'first' }, { NAME: 'second', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }]
    await load('REMOVE_ROW_FORM', namedMethod, { LAB_REQUEST: { items: labChain } }, { LAB_REQUEST: rows })
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')).not.toBeNull())

    findAll('.array-item-remove')[0].click()
    await until(() => expect(data('REMOVE_ROW_FORM').LAB_REQUEST).toHaveLength(1))
    await settle()

    expect(data('REMOVE_ROW_FORM').LAB_REQUEST).toEqual([{ NAME: 'second', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }])
  })

  // rjsf gives every row a new key when the number of rows changes from outside, so every row remounts
  it('keeps the values of a record whose rows replace a different number of rows', async () => {
    await load('REPLACED_ROWS_FORM', namedMethod, { LAB_REQUEST: { items: labChain } }, { LAB_REQUEST: [{ NAME: 'draft' }] })
    await until(() => expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID')).not.toBeNull())

    const rows = [{ NAME: 'one', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }, { NAME: 'two', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }]
    arrive('REPLACED_ROWS_FORM', { LAB_REQUEST: rows })
    await until(() => expect(data('REPLACED_ROWS_FORM').LAB_REQUEST).toHaveLength(2))
    await settle()

    expect(data('REPLACED_ROWS_FORM').LAB_REQUEST).toEqual(rows)
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L1')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D1')
      expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D1')
    })
  })

  it('still clears the values of a chain an allOf branch hides in a row that stays', async () => {
    const kindRequest = {
      type: 'object',
      properties: { KIND: { type: 'string', title: 'Kind', enum: ['LAB', 'NONE'] } },
      allOf: [{ if: { properties: { KIND: { const: 'LAB' } } }, then: { properties: labRequest.properties } }]
    }
    const method = { type: 'object', properties: { LAB_REQUEST: { type: 'array', items: kindRequest } } }
    await load('HIDDEN_CHAIN_FORM', method, { LAB_REQUEST: { items: labChain } }, { LAB_REQUEST: [{ KIND: 'LAB', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }] })
    await until(() => expect(select('root_LAB_REQUEST_0_DEPARTMENT')).not.toBeNull())

    // rjsf's select takes the option's index: 1 is NONE
    pick('root_LAB_REQUEST_0_KIND', '1')
    await until(() => expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID')).toBeNull())
    await settle()

    const [row] = data('HIDDEN_CHAIN_FORM').LAB_REQUEST
    expect(row.KIND).toBe('NONE')
    expect(row.LAB_OBJ_ID).toBeUndefined()
    expect(row.DEPARTMENT).toBeUndefined()
  })

  const atLeastOneRow = { type: 'object', properties: { LAB_REQUEST: { type: 'array', items: labRequest, minItems: 1 } } }
  const twoRows = { LAB_REQUEST: [{ LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }, { LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }] }

  it('redraws a row moved up by removing the one above under its new ids, and writes picks into it', async () => {
    mountForm({ id: 'MOVED_ROW_FORM', method: atLeastOneRow, uiSchemaConfigMethod: { LAB_REQUEST: { items: labChain } }, tableFormDataMethod: twoRows })
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D2'))

    findAll('.array-item-remove')[0].click()
    await until(() => expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID')).not.toBeNull())
    await settle()
    expect(find('select[id^="root_LAB_REQUEST_1_"]')).toBeNull()
    expect(data('MOVED_ROW_FORM').LAB_REQUEST).toEqual([{ LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }])
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L2')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D2')
    })

    pick('root_LAB_REQUEST_0_LAB_OBJ_ID', 'L1')
    await until(() => expect(options('root_LAB_REQUEST_0_DEPARTMENT')).toEqual(['D1']))
    expect(data('MOVED_ROW_FORM').LAB_REQUEST).toEqual([expect.objectContaining({ LAB_OBJ_ID: 'L1' })])
  })

  it('redraws both rows under their new ids, with their own values, when a row moves down', async () => {
    mountForm({ id: 'REORDERED_ROWS_FORM', method: atLeastOneRow, uiSchemaConfigMethod: { LAB_REQUEST: { items: labChain } }, tableFormDataMethod: twoRows })
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D2'))

    findAll('.array-item-move-down')[0].click()
    await until(() => expect(data('REORDERED_ROWS_FORM').LAB_REQUEST[0].LAB_OBJ_ID).toBe('L2'))
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L2')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D2')
      expect(select('root_LAB_REQUEST_1_LAB_OBJ_ID').value).toBe('L1')
      expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D1')
    })
    expect(data('REORDERED_ROWS_FORM').LAB_REQUEST).toEqual([{ LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }, { LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }])
  })
})
