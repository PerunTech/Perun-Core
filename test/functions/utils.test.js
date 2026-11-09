// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

// utils.js loads the store, and config.js reads window.server when it loads
vi.hoisted(() => {
  window.server = 'http://backend'
})
vi.mock('../../frontend/components/ComponentsIndex', () => ({ Loading: () => null }))

import { getObjectValueByKey, locateArrayField, schemaAtPath, uiSchemaAtPath } from '../../frontend/functions/utils'

describe('getObjectValueByKey', () => {
  it('finds a key at the top level or in a nested object', () => {
    expect(getObjectValueByKey({ GPS_NORTH: '41°59\'00\'\'' }, 'GPS_NORTH')).toBe('41°59\'00\'\'')
    expect(getObjectValueByKey({ LOCATION: { COORDS: { GPS_EAST: '21' } } }, 'GPS_EAST')).toBe('21')
    expect(getObjectValueByKey({ ITEMS: [{ NAME: 'a' }, { QTY: 5 }] }, 'QTY')).toBe(5)
  })

  it('returns the first match it comes to', () => {
    expect(getObjectValueByKey({ A: { X: 1 }, B: { X: 2 } }, 'X')).toBe(1)
    expect(getObjectValueByKey({ X: 0, A: { X: 2 } }, 'X')).toBe(0)
  })

  it('returns undefined for a key that is not there', () => {
    expect(getObjectValueByKey({ A: 1, B: { C: 'x' } }, 'X')).toBeUndefined()
  })

  it('returns undefined for missing or non-object data', () => {
    expect(getObjectValueByKey(undefined, 'X')).toBeUndefined()
    expect(getObjectValueByKey(null, 'X')).toBeUndefined()
    expect(getObjectValueByKey('GPS_NORTH', 'GPS_NORTH')).toBeUndefined()
    expect(getObjectValueByKey(5, 'X')).toBeUndefined()
  })

  it('looks past null and other non-object values at any depth', () => {
    expect(getObjectValueByKey({ A: null, B: 'text', C: 3, D: { E: null, X: 'found' } }, 'X')).toBe('found')
    expect(getObjectValueByKey({ A: { B: null } }, 'X')).toBeUndefined()
  })
})

const sampleForm = {
  type: 'object',
  properties: {
    NOTE: { type: 'string' },
    lab: { type: 'string' },
    lab_request: {
      type: 'array',
      items: { type: 'object', properties: { LAB_OBJ_ID: { type: 'string' }, DEPARTMENT: { type: 'string' } } }
    },
    inspection_sample: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          'inspection_sample.basic_info': { type: 'object', properties: { SAMPLE_TYPE: { type: 'string' } } }
        },
        allOf: [{ if: {}, then: { properties: { EXTRA_INFO: { type: 'string' } } } }]
      }
    }
  }
}

describe('locateArrayField', () => {
  it('finds a field in an array at the root', () => {
    const schema = { type: 'array', items: { type: 'object', properties: { DEPARTMENT: { type: 'string' } } } }
    expect(locateArrayField(schema, 'root_12_DEPARTMENT')).toEqual({ arrayPath: [], index: 12, itemPath: [], field: 'DEPARTMENT' })
  })

  it('finds a field in an array inside the form, past a shorter key that shares its start', () => {
    expect(locateArrayField(sampleForm, 'root_lab_request_0_LAB_OBJ_ID'))
      .toEqual({ arrayPath: ['lab_request'], index: 0, itemPath: [], field: 'LAB_OBJ_ID' })
  })

  it('finds a field in a section of an array item, keeping the dot in its key', () => {
    expect(locateArrayField(sampleForm, 'root_inspection_sample_3_inspection_sample.basic_info_SAMPLE_TYPE'))
      .toEqual({ arrayPath: ['inspection_sample'], index: 3, itemPath: ['inspection_sample.basic_info'], field: 'SAMPLE_TYPE' })
  })

  it('finds a field that only an allOf branch declares', () => {
    expect(locateArrayField(sampleForm, 'root_inspection_sample_0_EXTRA_INFO'))
      .toEqual({ arrayPath: ['inspection_sample'], index: 0, itemPath: [], field: 'EXTRA_INFO' })
  })

  it('returns null outside an array and for an ID the schema does not have', () => {
    expect(locateArrayField(sampleForm, 'root_NOTE')).toBeNull()
    expect(locateArrayField(sampleForm, 'root_lab_request_0_NOPE')).toBeNull()
    expect(locateArrayField(sampleForm, undefined)).toBeNull()
  })
})

describe('schemaAtPath and uiSchemaAtPath', () => {
  it('step into an array item by index', () => {
    const uiSchema = { inspection_sample: { items: { 'inspection_sample.basic_info': { SAMPLE_TYPE: { codelistName: 'FOOD_SAMPLE_TYPE' } } } } }
    const path = ['inspection_sample', 0, 'inspection_sample.basic_info']
    expect(schemaAtPath(sampleForm, path).properties.SAMPLE_TYPE).toEqual({ type: 'string' })
    expect(uiSchemaAtPath(uiSchema, path).SAMPLE_TYPE.codelistName).toBe('FOOD_SAMPLE_TYPE')
  })
})
