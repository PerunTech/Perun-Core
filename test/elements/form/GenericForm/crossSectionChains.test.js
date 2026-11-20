// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { cleanUpEach, data, find, findAll, mountForm, options, pick, requested, select, serveCodelists, settle, until } from './harness.js'

// A level's values carry the parent value they were asked for. T3 has no units and X2 no lab
// subtypes: the server answers the first with no items at all, the second with an empty list.
let get

beforeEach(() => {
  const suffixed = (value) => (parent) => [`${value}-${parent}`]
  get = serveCodelists({
    roots: { TYPES: ['T1', 'T2', 'T3'], LAB_TYPES: ['X1', 'X2'] },
    levels: { SUBTYPES: suffixed('S'), UNITS: suffixed('U'), LAB_SUBS: (parent) => (parent === 'X2' ? [] : [`L-${parent}`]) },
    other: (url) => url.endsWith('/UNITS/parent-code-value/T3') && { data: { type: 'SUCCESS', data: {} } }
  })
})

// The parent values a level's codelist was asked for
const asked = (codelist) => requested(get).filter((url) => url.includes(`/codelist-name/${codelist}/`)).map((url) => url.split('/').pop())

describe('GenericForm DependencyDropdown with fields depending on it in other sections', { timeout: 15000 }, () => {
  cleanUpEach()

  const method = {
    type: 'object',
    properties: {
      'smp.basic': { type: 'object', properties: { SAMPLE_TYPE: { type: 'string', title: 'Type' }, SAMPLE_SUBTYPE: { type: 'string', title: 'Subtype' } } },
      'smp.more': { type: 'object', required: ['NO_UNITS'], properties: { WEIGHT: { type: 'string', title: 'Weight' }, NO_UNITS: { type: 'string', title: 'Units' } } },
      'smp.lab': { type: 'object', properties: { SAMPLE_TYPE: { type: 'string', title: 'Lab type' }, LAB_SUB: { type: 'string', title: 'Lab subtype' } } }
    }
  }
  const uiSchema = {
    'smp.basic': {
      SAMPLE_TYPE: { 'ui:widget': 'DependencyDropdown', codelistName: 'TYPES', order: 0 },
      SAMPLE_SUBTYPE: { 'ui:widget': 'hidden', dependentOnField: 'SAMPLE_TYPE', codelistName: 'SUBTYPES', order: 1 }
    },
    'smp.more': {
      NO_UNITS: { 'ui:widget': 'hidden', dependentOnField: 'SAMPLE_TYPE', codelistName: 'UNITS', order: 2 }
    },
    'smp.lab': {
      SAMPLE_TYPE: { 'ui:widget': 'DependencyDropdown', codelistName: 'LAB_TYPES', order: 0 },
      LAB_SUB: { 'ui:widget': 'hidden', dependentOnField: 'SAMPLE_TYPE', codelistName: 'LAB_SUBS', order: 1 }
    }
  }

  async function load (id, record) {
    mountForm({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: record })
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_TYPE')).not.toBeNull()
      expect(select('root_smp.lab_SAMPLE_TYPE')).not.toBeNull()
    })
  }

  async function walk (id) {
    pick('root_smp.basic_SAMPLE_TYPE', 'T1')
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_SUBTYPE')).not.toBeNull()
      expect(select('root_smp.more_NO_UNITS')).not.toBeNull()
    })
    pick('root_smp.basic_SAMPLE_SUBTYPE', 'S-T1')
    pick('root_smp.more_NO_UNITS', 'U-T1')
    await until(() => expect(data(id)['smp.more']?.NO_UNITS).toBe('U-T1'))
  }

  it('draws every field depending on the root, one in another section too, and keeps each pick in its own section', async () => {
    await load('CROSS_WALK_FORM', {})
    await walk('CROSS_WALK_FORM')
    expect(asked('UNITS')).toEqual(['T1'])
    expect(select('root_smp.more_NO_UNITS').required).toBe(true)
    expect(select('root_smp.basic_SAMPLE_SUBTYPE').required).toBe(false)
    expect(data('CROSS_WALK_FORM')['smp.basic']).toEqual({ SAMPLE_TYPE: 'T1', SAMPLE_SUBTYPE: 'S-T1' })
    expect(data('CROSS_WALK_FORM')['smp.more']).toEqual({ NO_UNITS: 'U-T1' })
    expect(select('root_smp.lab_LAB_SUB')).toBeNull()
  })

  it('clears what was picked below the root in every section when it changes, and draws the new options', async () => {
    await load('CROSS_CHANGE_FORM', {})
    await walk('CROSS_CHANGE_FORM')
    pick('root_smp.basic_SAMPLE_TYPE', 'T2')
    await until(() => {
      expect(options('root_smp.more_NO_UNITS')).toEqual(['U-T2'])
      expect(options('root_smp.basic_SAMPLE_SUBTYPE')).toEqual(['S-T2'])
    })
    expect(select('root_smp.more_NO_UNITS').value).toBe('')
    expect(select('root_smp.basic_SAMPLE_SUBTYPE').value).toBe('')
    expect(data('CROSS_CHANGE_FORM')['smp.basic']).toEqual({ SAMPLE_TYPE: 'T2' })
    expect(data('CROSS_CHANGE_FORM')['smp.more']).toEqual({})
  })

  it('leaves the fields of a section with a root of the same name to that root', async () => {
    await load('CROSS_SAME_NAME_FORM', {})
    pick('root_smp.lab_SAMPLE_TYPE', 'X1')
    await until(() => expect(select('root_smp.lab_LAB_SUB')).not.toBeNull())
    expect(select('root_smp.more_NO_UNITS')).toBeNull()
    expect(select('root_smp.basic_SAMPLE_SUBTYPE')).toBeNull()

    await walk('CROSS_SAME_NAME_FORM')
    expect(findAll('select[id="root_smp.more_NO_UNITS"]')).toHaveLength(1)
    expect(options('root_smp.lab_LAB_SUB')).toEqual(['L-X1'])
    expect(data('CROSS_SAME_NAME_FORM')['smp.lab'].SAMPLE_TYPE).toBe('X1')
    expect(asked('UNITS')).toEqual(['T1'])
  })

  it('shows a saved record whose chain reaches into another section', async () => {
    const saved = { 'smp.basic': { SAMPLE_TYPE: 'T1', SAMPLE_SUBTYPE: 'S-T1' }, 'smp.more': { NO_UNITS: 'U-T1' } }
    await load('CROSS_SAVED_FORM', saved)
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_SUBTYPE')?.value).toBe('S-T1')
      expect(select('root_smp.more_NO_UNITS')?.value).toBe('U-T1')
    })
    expect(select('root_smp.basic_SAMPLE_TYPE').value).toBe('T1')
    expect(findAll('select[id="root_smp.more_NO_UNITS"]')).toHaveLength(1)
    expect(data('CROSS_SAVED_FORM')['smp.more'].NO_UNITS).toBe('U-T1')
  })

  it('leaves out a level with nothing to pick for its parent, and draws it again for a parent that has values', async () => {
    await load('CROSS_EMPTY_FORM', {})
    await walk('CROSS_EMPTY_FORM')
    pick('root_smp.basic_SAMPLE_TYPE', 'T3')
    await until(() => {
      expect(options('root_smp.basic_SAMPLE_SUBTYPE')).toEqual(['S-T3'])
      expect(asked('UNITS')).toEqual(['T1', 'T3'])
    })
    await settle()
    expect(select('root_smp.more_NO_UNITS')).toBeNull()
    expect(data('CROSS_EMPTY_FORM')['smp.more'].NO_UNITS).toBeUndefined()

    pick('root_smp.lab_SAMPLE_TYPE', 'X2')
    await until(() => expect(asked('LAB_SUBS')).toEqual(['X2']))
    await settle()
    expect(select('root_smp.lab_LAB_SUB')).toBeNull()

    pick('root_smp.basic_SAMPLE_TYPE', 'T2')
    await until(() => expect(options('root_smp.more_NO_UNITS')).toEqual(['U-T2']))
  })

  it('leaves out a level with nothing to pick when it shows a saved record', async () => {
    await load('CROSS_EMPTY_SAVED_FORM', { 'smp.basic': { SAMPLE_TYPE: 'T3', SAMPLE_SUBTYPE: 'S-T3' } })
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_SUBTYPE')?.value).toBe('S-T3')
      expect(asked('UNITS')).toEqual(['T3'])
    })
    await settle()
    expect(select('root_smp.more_NO_UNITS')).toBeNull()
  })
})

describe('GenericForm DependencyDropdown in an array item with fields depending on it in other sections of the item', { timeout: 15000 }, () => {
  cleanUpEach()

  const method = {
    type: 'object',
    properties: {
      SAMPLE: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            'smp.basic': { type: 'object', properties: { NAME: { type: 'string' }, SAMPLE_TYPE: { type: 'string', title: 'Type' }, SAMPLE_SUBTYPE: { type: 'string', title: 'Subtype' } } },
            'smp.more': { type: 'object', required: ['NO_UNITS'], properties: { WEIGHT: { type: 'string', title: 'Weight' }, NO_UNITS: { type: 'string', title: 'Units' } } }
          }
        }
      }
    }
  }
  const uiSchema = {
    SAMPLE: {
      items: {
        'smp.basic': {
          SAMPLE_TYPE: { 'ui:widget': 'DependencyDropdown', codelistName: 'TYPES', order: 0 },
          SAMPLE_SUBTYPE: { 'ui:widget': 'hidden', dependentOnField: 'SAMPLE_TYPE', codelistName: 'SUBTYPES', order: 1 }
        },
        'smp.more': {
          NO_UNITS: { 'ui:widget': 'hidden', dependentOnField: 'SAMPLE_TYPE', codelistName: 'UNITS', order: 1 }
        }
      }
    }
  }

  const id = (row, section, key) => `root_SAMPLE_${row}_smp.${section}_${key}`
  const rows = (formId) => data(formId)?.SAMPLE

  async function load (formId, record) {
    mountForm({ id: formId, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: record })
    await until(() => expect(find('[id="root_SAMPLE"] .array-item-add button')).not.toBeNull())
  }

  async function add (row) {
    find('[id="root_SAMPLE"] .array-item-add button').click()
    await until(() => expect(select(id(row, 'basic', 'SAMPLE_TYPE'))?.options.length).toBeGreaterThan(1))
  }

  async function walk (formId, row, sampleType) {
    pick(id(row, 'basic', 'SAMPLE_TYPE'), sampleType)
    await until(() => {
      expect(options(id(row, 'basic', 'SAMPLE_SUBTYPE'))).toEqual([`S-${sampleType}`])
      expect(options(id(row, 'more', 'NO_UNITS'))).toEqual([`U-${sampleType}`])
    })
    pick(id(row, 'basic', 'SAMPLE_SUBTYPE'), `S-${sampleType}`)
    pick(id(row, 'more', 'NO_UNITS'), `U-${sampleType}`)
    await until(() => expect(rows(formId)[row]['smp.more']?.NO_UNITS).toBe(`U-${sampleType}`))
  }

  it('draws a field of another section of the row depending on the root, and keeps each pick in its own section of the row', async () => {
    await load('ROW_CROSS_WALK_FORM', {})
    await add(0)
    await walk('ROW_CROSS_WALK_FORM', 0, 'T1')
    expect(asked('UNITS')).toEqual(['T1'])
    expect(select(id(0, 'more', 'NO_UNITS')).required).toBe(true)
    expect(select(id(0, 'basic', 'SAMPLE_SUBTYPE')).required).toBe(false)
    expect(rows('ROW_CROSS_WALK_FORM')[0]['smp.basic']).toEqual({ SAMPLE_TYPE: 'T1', SAMPLE_SUBTYPE: 'S-T1' })
    expect(rows('ROW_CROSS_WALK_FORM')[0]['smp.more']).toEqual({ NO_UNITS: 'U-T1' })
  })

  it('clears what was picked below the root in both sections of the row when it changes, and leaves out a level with nothing to pick', async () => {
    await load('ROW_CROSS_CHANGE_FORM', {})
    await add(0)
    await walk('ROW_CROSS_CHANGE_FORM', 0, 'T1')
    pick(id(0, 'basic', 'SAMPLE_TYPE'), 'T2')
    await until(() => {
      expect(options(id(0, 'more', 'NO_UNITS'))).toEqual(['U-T2'])
      expect(options(id(0, 'basic', 'SAMPLE_SUBTYPE'))).toEqual(['S-T2'])
    })
    expect(select(id(0, 'more', 'NO_UNITS')).value).toBe('')
    expect(rows('ROW_CROSS_CHANGE_FORM')[0]['smp.basic']).toEqual({ SAMPLE_TYPE: 'T2' })
    expect(rows('ROW_CROSS_CHANGE_FORM')[0]['smp.more']).toEqual({})

    pick(id(0, 'basic', 'SAMPLE_TYPE'), 'T3')
    await until(() => expect(asked('UNITS')).toEqual(['T1', 'T2', 'T3']))
    await settle()
    expect(select(id(0, 'more', 'NO_UNITS'))).toBeNull()
    expect(options(id(0, 'basic', 'SAMPLE_SUBTYPE'))).toEqual(['S-T3'])
  })

  it('keeps each row\'s chain to its own row', async () => {
    await load('ROW_CROSS_ROWS_FORM', {})
    await add(0)
    await walk('ROW_CROSS_ROWS_FORM', 0, 'T1')
    await add(1)
    await walk('ROW_CROSS_ROWS_FORM', 1, 'T2')
    expect(rows('ROW_CROSS_ROWS_FORM')).toEqual([
      { 'smp.basic': { SAMPLE_TYPE: 'T1', SAMPLE_SUBTYPE: 'S-T1' }, 'smp.more': { NO_UNITS: 'U-T1' } },
      { 'smp.basic': { SAMPLE_TYPE: 'T2', SAMPLE_SUBTYPE: 'S-T2' }, 'smp.more': { NO_UNITS: 'U-T2' } }
    ])
    expect(select(id(0, 'more', 'NO_UNITS')).value).toBe('U-T1')
    expect(findAll('select[id$="_NO_UNITS"]')).toHaveLength(2)
  })

  it('shows a saved record whose rows\' chains reach into another section, and keeps the row that moves up when the one above is removed', async () => {
    const saved = [
      { 'smp.basic': { NAME: 'first', SAMPLE_TYPE: 'T1', SAMPLE_SUBTYPE: 'S-T1' }, 'smp.more': { NO_UNITS: 'U-T1' } },
      { 'smp.basic': { NAME: 'second', SAMPLE_TYPE: 'T2', SAMPLE_SUBTYPE: 'S-T2' }, 'smp.more': { WEIGHT: '5', NO_UNITS: 'U-T2' } }
    ]
    await load('ROW_CROSS_SAVED_FORM', { SAMPLE: structuredClone(saved) })
    await until(() => {
      expect(select(id(0, 'more', 'NO_UNITS'))?.value).toBe('U-T1')
      expect(select(id(1, 'more', 'NO_UNITS'))?.value).toBe('U-T2')
    })

    findAll('.array-item-remove')[0].click()
    await until(() => expect(rows('ROW_CROSS_SAVED_FORM')).toHaveLength(1))
    await settle()
    expect(rows('ROW_CROSS_SAVED_FORM')).toEqual([saved[1]])
    await until(() => {
      expect(select(id(0, 'basic', 'SAMPLE_TYPE')).value).toBe('T2')
      expect(select(id(0, 'more', 'NO_UNITS'))?.value).toBe('U-T2')
    })
  })
})
