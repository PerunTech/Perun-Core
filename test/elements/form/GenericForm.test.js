// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// config.js reads window.server when it loads. React's production build, as the bundle has: the
// development one redraws on in-place edits that the production one does not.
vi.hoisted(() => {
  window.server = 'http://backend'
  process.env.NODE_ENV = 'production'
})
// The full index reaches client.js, which loads the labels from the server when it loads
vi.mock('../../../frontend/components/ComponentsIndex', () => ({ Loading: () => null }))

import React from 'react'
import axios from 'axios'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { IntlProvider } from 'react-intl'
import { store } from '../../../frontend/model'
import { ComponentManager } from '../../../frontend/elements/ComponentManager'
import GenericForm from '../../../frontend/elements/form/GenericForm'
import DependencyDropdown from '../../../frontend/elements/base/dropdown/DependencyDropdown'
import omit from 'lodash/omit'

const h = React.createElement

// The production build has no act(), so each step waits for what it should lead to. Generous: the
// first render in a file also loads rjsf and compiles the schema, which is slow on a busy runner.
const until = (check) => vi.waitFor(check, { timeout: 5000, interval: 10 })

const schema = {
  type: 'object',
  properties: {
    NOTE: { type: 'string' },
    ITEMS: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ID: { type: 'integer' },
          NAME: { type: 'string' },
          QTY: { type: 'integer' }
        }
      },
      default: []
    }
  }
}

let root
let container
let wrapper

// Stands in for the modules' input wrappers, which get the form instance and write into it
const Wrapper = (props) => {
  wrapper = props
  return props.children
}

const input = (id) => container.querySelector(`[id="${id}"]`)
const items = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')?.ITEMS

function mount (props) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(h(Provider, { store },
    h(IntlProvider, { locale: 'en', messages: {}, onError: () => {} },
      h(GenericForm, { params: 'FORM_DATA', hideBtns: 'all', ...props }))))
}

async function renderForm (id) {
  mount({ id, method: schema, uiSchemaConfigMethod: {}, tableFormDataMethod: {}, inputWrapper: Wrapper })
  // Loaded: the Add button is drawn and the schema's defaults are published
  await until(() => {
    expect(container.querySelector('.array-item-add button')).not.toBeNull()
    expect(items(id)).toEqual([])
  })
}

async function addItem (formId) {
  container.querySelector('.array-item-add button').click()
  await until(() => {
    expect(input('root_ITEMS_0_NAME')).not.toBeNull()
    expect(items(formId)).toHaveLength(1)
  })
}

function type (element, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
}

describe('GenericForm', { timeout: 15000 }, () => {
  afterEach(() => {
    root.unmount()
    container.remove()
  })

  it('shows a value a wrapper writes into an array item of formTableData in place', async () => {
    await renderForm('IN_PLACE_FORM')
    await addItem('IN_PLACE_FORM')

    // What the RecordSelectWrapper copies do with a picked row
    const formData = ComponentManager.getStateForComponent('IN_PLACE_FORM', 'formTableData')
    formData.ITEMS[0] = { ...formData.ITEMS[0], ID: 4711, NAME: 'Amoxicillin' }
    ComponentManager.setStateForComponent('IN_PLACE_FORM', 'formTableData', formData)
    wrapper.formInstance.setState({ formTableData: formData })
    wrapper.formInstance.onInputChange(formData)

    await until(() => {
      expect(input('root_ITEMS_0_NAME').value).toBe('Amoxicillin')
      expect(input('root_ITEMS_0_ID').value).toBe('4711')
    })

    type(input('root_ITEMS_0_QTY'), '5')

    await until(() => expect(items('IN_PLACE_FORM')).toEqual([{ ID: 4711, NAME: 'Amoxicillin', QTY: 5 }]))
    expect(input('root_ITEMS_0_NAME').value).toBe('Amoxicillin')
  })

  it('takes the form data itself as well as an rjsf change event', async () => {
    await renderForm('PLAIN_DATA_FORM')
    await addItem('PLAIN_DATA_FORM')

    const current = ComponentManager.getStateForComponent('PLAIN_DATA_FORM', 'formTableData')
    wrapper.formInstance.onInputChange({ ...current, NOTE: 'picked', ITEMS: [{ ID: 815, NAME: 'Oxytetracycline' }] })

    await until(() => {
      expect(input('root_NOTE').value).toBe('picked')
      expect(input('root_ITEMS_0_NAME').value).toBe('Oxytetracycline')
    })
  })

  // A form remounted under a new id draws before that id's formTableData reaches its props
  it('draws a GPSCoordinate field while the form has no formTableData', async () => {
    const pageErrors = []
    const onError = (event) => pageErrors.push(event.error)
    window.addEventListener('error', onError)
    try {
      mount({
        id: 'GPS_FORM',
        method: { type: 'object', properties: { GPS_NORTH: { type: 'string' }, GPS_EAST: { type: 'string' } } },
        uiSchemaConfigMethod: { GPS_NORTH: { 'ui:widget': 'GPSCoordinate' }, GPS_EAST: { 'ui:widget': 'GPSCoordinate' } },
        tableFormDataMethod: undefined
      })
      await until(() => {
        expect(input('root_GPS_NORTH')?.value).toBe("00°00'00''")
        expect(input('root_GPS_EAST')?.value).toBe("00°00'00''")
      })
      expect(pageErrors).toEqual([])
    } finally {
      window.removeEventListener('error', onError)
    }
  })
})

describe('GenericForm DependencyDropdown in an array item', { timeout: 15000 }, () => {
  const labRequest = { type: 'object', properties: { LAB_OBJ_ID: { type: 'string', title: 'Laboratory' }, DEPARTMENT: { type: 'string', title: 'Department' } } }
  const labChain = {
    LAB_OBJ_ID: { 'ui:widget': 'DependencyDropdown', codelistName: 'LABS', order: 0 },
    DEPARTMENT: { 'ui:widget': 'hidden', dependentOnField: 'LAB_OBJ_ID', codelistName: 'LAB_DEPT', order: 1 }
  }
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    get = vi.spyOn(axios, 'get').mockImplementation((url) => Promise.resolve(url.includes('getDependentDropdown')
      ? { data: { data: { items: [{ object_id: 21, CODE_VALUE: 'D1', LBL_TRANSL: 'Serology' }] } } }
      : { data: [{ 'SVAROG_CODES.OBJECT_ID': 11, 'SVAROG_CODES.CODE_VALUE': 'L1', 'SVAROG_CODES.LABEL_CODE': 'Lab one' }] }))
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    root.unmount()
    container.remove()
  })

  const select = (id) => container.querySelector(`select[id="${id}"]`)
  const data = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')

  async function load (id, method, uiSchema, formData) {
    mount({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: formData })
    await until(() => expect(container.querySelector('.array-item-add button')).not.toBeNull())
  }

  async function add (arrayId, firstSelect) {
    container.querySelector(`[id="${arrayId}"] .array-item-add button`).click()
    await until(() => expect(select(firstSelect)).not.toBeNull())
  }

  function pick (id, value) {
    const el = select(id)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }

  it('keeps working in an array at the root of the schema', async () => {
    await load('ROOT_ARRAY_FORM', { type: 'array', items: labRequest }, { items: labChain }, [])
    await add('root', 'root_0_LAB_OBJ_ID')
    pick('root_0_LAB_OBJ_ID', 'L1')

    await until(() => expect(select('root_0_DEPARTMENT')).not.toBeNull())
    expect(data('ROOT_ARRAY_FORM')[0].LAB_OBJ_ID).toBe('L1')
    expect(pageErrors).toEqual([])
  })

  it('draws, fills and chains in an array inside the form, row by row', async () => {
    const method = { type: 'object', properties: { NOTE: { type: 'string' }, LAB_REQUEST: { type: 'array', items: labRequest } } }
    await load('NESTED_ARRAY_FORM', method, { LAB_REQUEST: { items: labChain } }, { NOTE: 'kept' })
    await add('root_LAB_REQUEST', 'root_LAB_REQUEST_0_LAB_OBJ_ID')
    expect(get.mock.calls.some(([url]) => url.includes('LABS'))).toBe(true)

    pick('root_LAB_REQUEST_0_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_LAB_REQUEST_0_DEPARTMENT')).not.toBeNull())
    expect(data('NESTED_ARRAY_FORM').NOTE).toBe('kept')
    expect(data('NESTED_ARRAY_FORM').LAB_REQUEST[0].LAB_OBJ_ID).toBe('L1')

    await add('root_LAB_REQUEST', 'root_LAB_REQUEST_1_LAB_OBJ_ID')
    pick('root_LAB_REQUEST_1_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')).not.toBeNull())
    expect(data('NESTED_ARRAY_FORM').LAB_REQUEST.map(row => row.LAB_OBJ_ID)).toEqual(['L1', 'L1'])
    expect(pageErrors).toEqual([])
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
    expect(get.mock.calls.map(([url]) => url).filter(url => url.includes('LABS'))).toEqual([])
    expect(get.mock.calls.some(([url]) => url.includes('FOOD_SAMPLE_TYPE'))).toBe(true)

    pick('root_SAMPLE_0_SAMPLE.basic_info_SAMPLE_TYPE', 'L1')
    await until(() => expect(select('root_SAMPLE_0_SAMPLE.basic_info_SAMPLE_SUBTYPE')).not.toBeNull())
    expect(data('SECTION_IN_ITEM_FORM').SAMPLE[0]['SAMPLE.basic_info'].SAMPLE_TYPE).toBe('L1')
    expect(pageErrors).toEqual([])
  })

  // The removed row's chain clears its values a tick after it unmounts
  const afterUnmountClear = () => new Promise((resolve) => setTimeout(resolve, 50))
  const namedRequest = { ...labRequest, properties: { NAME: { type: 'string' }, ...labRequest.properties } }
  const namedMethod = { type: 'object', properties: { LAB_REQUEST: { type: 'array', items: namedRequest } } }

  it('keeps the values of the row that moves up when the row above it is removed', async () => {
    const rows = [{ NAME: 'first' }, { NAME: 'second', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }]
    await load('REMOVE_ROW_FORM', namedMethod, { LAB_REQUEST: { items: labChain } }, { LAB_REQUEST: rows })
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')).not.toBeNull())

    container.querySelectorAll('.array-item-remove')[0].click()
    await until(() => expect(data('REMOVE_ROW_FORM').LAB_REQUEST).toHaveLength(1))
    await afterUnmountClear()

    expect(data('REMOVE_ROW_FORM').LAB_REQUEST).toEqual([{ NAME: 'second', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }])
    expect(pageErrors).toEqual([])
  })

  // rjsf gives every row a new key when the number of rows changes from outside, so every row remounts
  it('keeps the values of a record whose rows replace a different number of rows', async () => {
    await load('REPLACED_ROWS_FORM', namedMethod, { LAB_REQUEST: { items: labChain } }, { LAB_REQUEST: [{ NAME: 'draft' }] })
    await until(() => expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID')).not.toBeNull())

    const rows = [{ NAME: 'one', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }, { NAME: 'two', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }]
    store.dispatch({ type: 'REPLACED_ROWS_FORM_tabledata/FETCH_FORM_TABLE_DATA_FULFILLED', payload: structuredClone({ LAB_REQUEST: rows }) })
    await until(() => expect(data('REPLACED_ROWS_FORM').LAB_REQUEST).toHaveLength(2))
    await afterUnmountClear()

    expect(data('REPLACED_ROWS_FORM').LAB_REQUEST).toEqual(rows)
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L1')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D1')
      expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D1')
    })
    expect(pageErrors).toEqual([])
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
    await afterUnmountClear()

    const [row] = data('HIDDEN_CHAIN_FORM').LAB_REQUEST
    expect(row.KIND).toBe('NONE')
    expect(row.LAB_OBJ_ID).toBeUndefined()
    expect(row.DEPARTMENT).toBeUndefined()
    expect(pageErrors).toEqual([])
  })
})

describe('GenericForm DependencyDropdown in sections', { timeout: 15000 }, () => {
  const method = {
    type: 'object',
    properties: {
      'cp.scope': { type: 'object', properties: { REGION_CODE: { type: 'string', title: 'Region' }, MUNIC_CODE: { type: 'string', title: 'Municipality' } } },
      'cp.lab': {
        type: 'object',
        properties: {
          LAB_OBJ_ID: { type: 'string', title: 'Laboratory' },
          DEPARTMENT: { type: 'string', title: 'Department' },
          IS_ACCREDITED: { type: 'boolean', title: 'Accredited' },
          PURPOSE: { type: 'string', title: 'Purpose' }
        },
        allOf: [{ if: { properties: { PURPOSE: { const: 'ABORT' } }, required: ['PURPOSE'] }, then: { properties: { PACKAGE: { type: 'string', title: 'Package' } } } }]
      }
    }
  }
  const uiSchema = {
    'cp.scope': {
      REGION_CODE: { 'ui:widget': 'DependencyDropdown', codelistName: 'REGIONS', order: 0 },
      MUNIC_CODE: { 'ui:widget': 'hidden', dependentOnField: 'REGION_CODE', codelistName: 'MUNICIPALITIES', order: 1 }
    },
    'cp.lab': {
      LAB_OBJ_ID: { 'ui:widget': 'DependencyDropdown', codelistName: 'LABS', order: 0 },
      DEPARTMENT: { 'ui:widget': 'hidden', dependentOnField: 'LAB_OBJ_ID', codelistName: 'LAB_DEPT', order: 1 },
      IS_ACCREDITED: { 'ui:widget': 'DependentValueField', dependentOnField: 'DEPARTMENT', codelistName: 'ACCREDITED' },
      PACKAGE: { 'ui:widget': 'DependencyDropdown', codelistName: 'PACKAGE', order: 0 }
    }
  }
  const codes = { REGIONS: ['R1', 'R2'], LABS: ['L1', 'L2'], PACKAGE: ['P1'], MUNICIPALITIES: ['M1'], LAB_DEPT: ['D1'] }
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    get = vi.spyOn(axios, 'get').mockImplementation((url) => {
      if (url.includes('getDependentFieldValue')) return Promise.resolve({ data: { data: { value: true } } })
      const name = Object.keys(codes).find((c) => url.includes(`/${c}/`))
      const values = codes[name] || []
      return Promise.resolve(url.includes('getDependentDropdown')
        ? { data: { data: { items: values.map((v, i) => ({ object_id: i + 1, CODE_VALUE: v, LBL_TRANSL: v })) } } }
        : { data: values.map((v, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': v, 'SVAROG_CODES.LABEL_CODE': v })) })
    })
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    root.unmount()
    container.remove()
  })

  const select = (id) => container.querySelector(`select[id="${id}"]`)
  const data = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')
  const initialCodelists = () => get.mock.calls.map(([url]) => url.match(/PARENT_CODE_VALUE\/([^/]+)\//)?.[1]).filter(Boolean)

  async function load (id, formData, ...firstSelects) {
    mount({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: formData })
    await until(() => firstSelects.forEach((s) => expect(select(s)).not.toBeNull()))
  }

  function pick (id, value) {
    const el = select(id)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }

  it('gives each root in each section its own field and codelist', async () => {
    await load('SECTION_ROOTS_FORM', {}, 'root_cp.scope_REGION_CODE', 'root_cp.lab_LAB_OBJ_ID')
    expect(new Set(initialCodelists())).toEqual(new Set(['REGIONS', 'LABS']))
    expect(pageErrors).toEqual([])
  })

  it('draws a root that only an allOf branch of its section declares', async () => {
    await load('SECTION_ALLOF_FORM', { 'cp.lab': { PURPOSE: 'ABORT' } }, 'root_cp.lab_LAB_OBJ_ID', 'root_cp.lab_PACKAGE')
    expect(initialCodelists()).toContain('PACKAGE')
    expect(pageErrors).toEqual([])
  })

  it('leaves the other chains alone when one root changes', async () => {
    await load('SECTION_CHAINS_FORM', {}, 'root_cp.scope_REGION_CODE', 'root_cp.lab_LAB_OBJ_ID')
    pick('root_cp.scope_REGION_CODE', 'R1')
    await until(() => expect(select('root_cp.scope_MUNIC_CODE')).not.toBeNull())
    pick('root_cp.lab_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull())

    pick('root_cp.scope_REGION_CODE', 'R2')
    await until(() => expect(data('SECTION_CHAINS_FORM')['cp.scope'].REGION_CODE).toBe('R2'))
    expect(select('root_cp.lab_LAB_OBJ_ID')?.value).toBe('L1')
    expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull()
    expect(data('SECTION_CHAINS_FORM')['cp.lab'].LAB_OBJ_ID).toBe('L1')
    expect(pageErrors).toEqual([])
  })

  it('shows a saved record with two roots in one section, each with its own value and chain', async () => {
    const saved = { 'cp.lab': { LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1', PURPOSE: 'ABORT', PACKAGE: 'P1' } }
    await load('SECTION_SAVED_FORM', saved, 'root_cp.lab_LAB_OBJ_ID', 'root_cp.lab_PACKAGE')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')?.value).toBe('D1'))
    await until(() => {
      expect(select('root_cp.lab_LAB_OBJ_ID').value).toBe('L1')
      expect(select('root_cp.lab_PACKAGE').value).toBe('P1')
    })
    expect(container.querySelectorAll('select[id="root_cp.lab_DEPARTMENT"]')).toHaveLength(1)
    expect(pageErrors).toEqual([])
  })

  it('looks up a DependentValueField from the value in its own section', async () => {
    await load('SECTION_VALUE_FORM', {}, 'root_cp.lab_LAB_OBJ_ID')
    pick('root_cp.lab_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull())
    pick('root_cp.lab_DEPARTMENT', 'D1')
    await until(() => expect(get.mock.calls.some(([url]) => url.includes('codelist-name/ACCREDITED/parent-code-value/D1/attribute/IS_ACCREDITED'))).toBe(true))
    await until(() => expect(data('SECTION_VALUE_FORM')['cp.lab'].IS_ACCREDITED).toBe(true))
    expect(pageErrors).toEqual([])
  })

  it('keeps a root change when the DependentValueField below it clears itself', async () => {
    await load('SECTION_CLEAR_FORM', {}, 'root_cp.lab_LAB_OBJ_ID')
    pick('root_cp.lab_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull())
    pick('root_cp.lab_DEPARTMENT', 'D1')
    await until(() => expect(data('SECTION_CLEAR_FORM')['cp.lab'].IS_ACCREDITED).toBe(true))

    pick('root_cp.lab_LAB_OBJ_ID', 'L2')
    await until(() => expect(data('SECTION_CLEAR_FORM')['cp.lab'].IS_ACCREDITED).toBeUndefined())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(data('SECTION_CLEAR_FORM')['cp.lab'].LAB_OBJ_ID).toBe('L2')
    expect(data('SECTION_CLEAR_FORM')['cp.lab'].DEPARTMENT).toBeUndefined()
    expect(pageErrors).toEqual([])
  })
})

describe('GenericForm DependencyDropdown with fields depending on it in other sections', { timeout: 15000 }, () => {
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
  const codes = { TYPES: ['T1', 'T2', 'T3'], LAB_TYPES: ['X1', 'X2'], SUBTYPES: ['S'], UNITS: ['U'], LAB_SUBS: ['L'] }
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    // A level's values carry the parent value they were asked for. T3 has no units and X2 no lab
    // subtypes: the server answers the first with no items at all, the second with an empty list.
    get = vi.spyOn(axios, 'get').mockImplementation((url) => {
      const name = Object.keys(codes).find((c) => url.includes(`/${c}/`))
      const parent = url.match(/parent-code-value\/([^/]+)$/)?.[1]
      if (name === 'UNITS' && parent === 'T3') return Promise.resolve({ data: { type: 'SUCCESS', data: {} } })
      if (name === 'LAB_SUBS' && parent === 'X2') return Promise.resolve({ data: { data: { items: [] } } })
      const values = (codes[name] || []).map((v) => (parent ? `${v}-${parent}` : v))
      return Promise.resolve(url.includes('getDependentDropdown')
        ? { data: { data: { items: values.map((v, i) => ({ object_id: i + 1, CODE_VALUE: v, LBL_TRANSL: v })) } } }
        : { data: values.map((v, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': v, 'SVAROG_CODES.LABEL_CODE': v })) })
    })
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    root.unmount()
    container.remove()
  })

  const select = (id) => container.querySelector(`select[id="${id}"]`)
  const options = (id) => Array.from(select(id)?.options ?? []).map((o) => o.value).filter(Boolean)
  const data = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')
  const asked = (codelist) => get.mock.calls.filter(([url]) => url.includes(`/codelist-name/${codelist}/`)).map(([url]) => url.split('/').pop())

  async function load (id, formData) {
    mount({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: formData })
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_TYPE')).not.toBeNull()
      expect(select('root_smp.lab_SAMPLE_TYPE')).not.toBeNull()
    })
  }

  function pick (id, value) {
    const el = select(id)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
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
    expect(pageErrors).toEqual([])
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
    expect(pageErrors).toEqual([])
  })

  it('leaves the fields of a section with a root of the same name to that root', async () => {
    await load('CROSS_SAME_NAME_FORM', {})
    pick('root_smp.lab_SAMPLE_TYPE', 'X1')
    await until(() => expect(select('root_smp.lab_LAB_SUB')).not.toBeNull())
    expect(select('root_smp.more_NO_UNITS')).toBeNull()
    expect(select('root_smp.basic_SAMPLE_SUBTYPE')).toBeNull()

    await walk('CROSS_SAME_NAME_FORM')
    expect(container.querySelectorAll('select[id="root_smp.more_NO_UNITS"]')).toHaveLength(1)
    expect(options('root_smp.lab_LAB_SUB')).toEqual(['L-X1'])
    expect(data('CROSS_SAME_NAME_FORM')['smp.lab'].SAMPLE_TYPE).toBe('X1')
    expect(asked('UNITS')).toEqual(['T1'])
    expect(pageErrors).toEqual([])
  })

  it('shows a saved record whose chain reaches into another section', async () => {
    const saved = { 'smp.basic': { SAMPLE_TYPE: 'T1', SAMPLE_SUBTYPE: 'S-T1' }, 'smp.more': { NO_UNITS: 'U-T1' } }
    await load('CROSS_SAVED_FORM', saved)
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_SUBTYPE')?.value).toBe('S-T1')
      expect(select('root_smp.more_NO_UNITS')?.value).toBe('U-T1')
    })
    expect(select('root_smp.basic_SAMPLE_TYPE').value).toBe('T1')
    expect(container.querySelectorAll('select[id="root_smp.more_NO_UNITS"]')).toHaveLength(1)
    expect(data('CROSS_SAVED_FORM')['smp.more'].NO_UNITS).toBe('U-T1')
    expect(pageErrors).toEqual([])
  })

  it('leaves out a level with nothing to pick for its parent, and draws it again for a parent that has values', async () => {
    await load('CROSS_EMPTY_FORM', {})
    await walk('CROSS_EMPTY_FORM')
    pick('root_smp.basic_SAMPLE_TYPE', 'T3')
    await until(() => {
      expect(options('root_smp.basic_SAMPLE_SUBTYPE')).toEqual(['S-T3'])
      expect(asked('UNITS')).toEqual(['T1', 'T3'])
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(select('root_smp.more_NO_UNITS')).toBeNull()
    expect(data('CROSS_EMPTY_FORM')['smp.more'].NO_UNITS).toBeUndefined()

    pick('root_smp.lab_SAMPLE_TYPE', 'X2')
    await until(() => expect(asked('LAB_SUBS')).toEqual(['X2']))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(select('root_smp.lab_LAB_SUB')).toBeNull()

    pick('root_smp.basic_SAMPLE_TYPE', 'T2')
    await until(() => expect(options('root_smp.more_NO_UNITS')).toEqual(['U-T2']))
    expect(pageErrors).toEqual([])
  })

  it('leaves out a level with nothing to pick when it shows a saved record', async () => {
    await load('CROSS_EMPTY_SAVED_FORM', { 'smp.basic': { SAMPLE_TYPE: 'T3', SAMPLE_SUBTYPE: 'S-T3' } })
    await until(() => {
      expect(select('root_smp.basic_SAMPLE_SUBTYPE')?.value).toBe('S-T3')
      expect(asked('UNITS')).toEqual(['T3'])
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(select('root_smp.more_NO_UNITS')).toBeNull()
    expect(pageErrors).toEqual([])
  })
})

describe('GenericForm DependencyDropdown in an array item with fields depending on it in other sections of the item', { timeout: 15000 }, () => {
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
  const codes = { TYPES: ['T1', 'T2', 'T3'], SUBTYPES: ['S'], UNITS: ['U'] }
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    // A level's values carry the parent value they were asked for; T3 has no units
    get = vi.spyOn(axios, 'get').mockImplementation((url) => {
      const name = Object.keys(codes).find((c) => url.includes(`/${c}/`))
      const parent = url.match(/parent-code-value\/([^/]+)$/)?.[1]
      if (name === 'UNITS' && parent === 'T3') return Promise.resolve({ data: { type: 'SUCCESS', data: {} } })
      const values = (codes[name] || []).map((v) => (parent ? `${v}-${parent}` : v))
      return Promise.resolve(url.includes('getDependentDropdown')
        ? { data: { data: { items: values.map((v, i) => ({ object_id: i + 1, CODE_VALUE: v, LBL_TRANSL: v })) } } }
        : { data: values.map((v, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': v, 'SVAROG_CODES.LABEL_CODE': v })) })
    })
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    root.unmount()
    container.remove()
  })

  const id = (row, section, key) => `root_SAMPLE_${row}_smp.${section}_${key}`
  const select = (selectId) => container.querySelector(`select[id="${selectId}"]`)
  const options = (selectId) => Array.from(select(selectId)?.options ?? []).map((o) => o.value).filter(Boolean)
  const rows = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')?.SAMPLE
  const asked = (codelist) => get.mock.calls.filter(([url]) => url.includes(`/codelist-name/${codelist}/`)).map(([url]) => url.split('/').pop())

  async function load (formId, formData) {
    mount({ id: formId, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: formData })
    await until(() => expect(container.querySelector('[id="root_SAMPLE"] .array-item-add button')).not.toBeNull())
  }

  async function add (row) {
    container.querySelector('[id="root_SAMPLE"] .array-item-add button').click()
    await until(() => expect(select(id(row, 'basic', 'SAMPLE_TYPE'))?.options.length).toBeGreaterThan(1))
  }

  function pick (selectId, value) {
    const el = select(selectId)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }

  async function walk (formId, row, type) {
    pick(id(row, 'basic', 'SAMPLE_TYPE'), type)
    await until(() => {
      expect(options(id(row, 'basic', 'SAMPLE_SUBTYPE'))).toEqual([`S-${type}`])
      expect(options(id(row, 'more', 'NO_UNITS'))).toEqual([`U-${type}`])
    })
    pick(id(row, 'basic', 'SAMPLE_SUBTYPE'), `S-${type}`)
    pick(id(row, 'more', 'NO_UNITS'), `U-${type}`)
    await until(() => expect(rows(formId)[row]['smp.more']?.NO_UNITS).toBe(`U-${type}`))
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
    expect(pageErrors).toEqual([])
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
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(select(id(0, 'more', 'NO_UNITS'))).toBeNull()
    expect(options(id(0, 'basic', 'SAMPLE_SUBTYPE'))).toEqual(['S-T3'])
    expect(pageErrors).toEqual([])
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
    expect(container.querySelectorAll('select[id$="_NO_UNITS"]')).toHaveLength(2)
    expect(pageErrors).toEqual([])
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

    container.querySelectorAll('.array-item-remove')[0].click()
    await until(() => expect(rows('ROW_CROSS_SAVED_FORM')).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(rows('ROW_CROSS_SAVED_FORM')).toEqual([saved[1]])
    await until(() => {
      expect(select(id(0, 'basic', 'SAMPLE_TYPE')).value).toBe('T2')
      expect(select(id(0, 'more', 'NO_UNITS'))?.value).toBe('U-T2')
    })
    expect(pageErrors).toEqual([])
  })
})

// The record lands after the schema: a form remounted under a new id, or a slow getTableFormData
describe('GenericForm DependencyDropdown with the record arriving after the form', { timeout: 15000 }, () => {
  const section = 'holding.location.info'
  const method = {
    type: 'object',
    properties: {
      'holding.basic': { type: 'object', properties: { ADDRESS: { type: 'string', title: 'Address' } } },
      [section]: {
        type: 'object',
        properties: {
          REGION_CODE: { type: 'string', title: 'Region' },
          MUNIC_CODE: { type: 'string', title: 'Municipality' },
          COMMUN_CODE: { type: 'string', title: 'Community' },
          VILLAGE_CODE: { type: 'string', title: 'Village' }
        }
      }
    }
  }
  const uiSchema = {
    [section]: {
      REGION_CODE: { 'ui:widget': 'DependencyDropdown', codelistName: 'REGIONS', order: 0 },
      MUNIC_CODE: { 'ui:widget': 'hidden', dependentOnField: 'REGION_CODE', codelistName: 'MUNICIPALITIES', order: 1 },
      COMMUN_CODE: { 'ui:widget': 'hidden', dependentOnField: 'MUNIC_CODE', codelistName: 'COMMUNITIES', order: 2 },
      VILLAGE_CODE: { 'ui:widget': 'hidden', dependentOnField: 'COMMUN_CODE', codelistName: 'VILLAGES', order: 3 }
    }
  }
  const record = { 'holding.basic': { ADDRESS: 'Street 9' }, [section]: { REGION_CODE: 'R1', MUNIC_CODE: 'M1', COMMUN_CODE: 'C1', VILLAGE_CODE: 'V1' } }
  const roots = { REGIONS: ['R1', 'R2'], LABS: ['L1', 'L2'] }
  const children = {
    MUNICIPALITIES: { R1: ['M1', 'M2'], R2: ['M3'] },
    COMMUNITIES: { M1: ['C1'], M2: ['C2'], M3: ['C3'] },
    VILLAGES: { C1: ['V1'], C3: ['V3'] },
    LAB_DEPT: { L1: ['D1'], L2: ['D2'] }
  }
  const [REGION, MUNIC, COMMUN, VILLAGE] = ['REGION_CODE', 'MUNIC_CODE', 'COMMUN_CODE', 'VILLAGE_CODE'].map((field) => `root_${section}_${field}`)
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    get = vi.spyOn(axios, 'get').mockImplementation((url) => {
      if (url.includes('getTableUISchema')) return Promise.resolve({ data: uiSchema })
      if (url.includes('getTableJSONSchema')) return Promise.resolve({ data: method })
      const root = url.match(/PARENT_CODE_VALUE\/([^/]+)\//)?.[1]
      if (root) {
        return Promise.resolve({ data: (roots[root] || []).map((v, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': v, 'SVAROG_CODES.LABEL_CODE': v })) })
      }
      const [, codelist, parent] = url.match(/codelist-name\/([^/]+)\/parent-code-value\/([^/]+)$/) || []
      const values = children[codelist]?.[parent] || []
      return Promise.resolve({ data: { data: { items: values.map((v, i) => ({ object_id: i + 1, CODE_VALUE: v, LBL_TRANSL: v })) } } })
    })
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    root.unmount()
    container.remove()
  })

  const select = (id) => container.querySelector(`select[id="${id}"]`)
  const options = (id) => Array.from(select(id)?.options || []).map((option) => option.value).filter(Boolean)
  const data = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')
  const rootFetches = (codelist) => get.mock.calls.filter(([url]) => url.includes(`PARENT_CODE_VALUE/${codelist}/`)).length
  const arrive = (formId, formData) => store.dispatch({ type: `${formId}_tabledata/FETCH_FORM_TABLE_DATA_FULFILLED`, payload: structuredClone(formData) })

  function pick (id, value) {
    const el = select(id)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }

  async function showRecordLate (id) {
    mount({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: undefined, inputWrapper: Wrapper })
    await until(() => expect(options(REGION)).toEqual(['R1', 'R2']))
    expect(select(REGION).value).toBe('')
    arrive(id, record)
    await until(() => {
      expect(select(REGION).value).toBe('R1')
      expect(select(MUNIC)?.value).toBe('M1')
      expect(select(COMMUN)?.value).toBe('C1')
      expect(select(VILLAGE)?.value).toBe('V1')
    })
  }

  it('shows the chain of a record that arrives after the form has drawn', async () => {
    await showRecordLate('LATE_RECORD_FORM')
    expect(container.querySelectorAll('select')).toHaveLength(4)
    expect(data('LATE_RECORD_FORM')[section]).toEqual(record[section])
    expect(pageErrors).toEqual([])
  })

  it('keeps a pick made after the record arrived when the form data comes back as props', async () => {
    await showRecordLate('LATE_PICK_FORM')
    const regionFetches = rootFetches('REGIONS')

    pick(REGION, 'R2')
    await until(() => expect(options(MUNIC)).toEqual(['M3']))
    expect(select(MUNIC).value).toBe('')
    expect(select(COMMUN)).toBeNull()
    expect(select(VILLAGE)).toBeNull()
    expect(data('LATE_PICK_FORM')[section]).toMatchObject({ REGION_CODE: 'R2', MUNIC_CODE: undefined, COMMUN_CODE: undefined, VILLAGE_CODE: undefined })

    pick(MUNIC, 'M3')
    await until(() => expect(options(COMMUN)).toEqual(['C3']))

    // An edit elsewhere, then a render of every field, which hands the chain the form data again
    type(container.querySelector('[id="root_holding.basic_ADDRESS"]'), 'Street 10')
    await until(() => expect(data('LATE_PICK_FORM')['holding.basic'].ADDRESS).toBe('Street 10'))
    wrapper.formInstance.setState({ disabled: true })
    await until(() => expect(container.querySelector('[id="root_holding.basic_ADDRESS"]').disabled).toBe(true))
    wrapper.formInstance.setState({ disabled: false })
    await until(() => expect(container.querySelector('[id="root_holding.basic_ADDRESS"]').disabled).toBe(false))
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(select(REGION).value).toBe('R2')
    expect(select(MUNIC).value).toBe('M3')
    expect(options(COMMUN)).toEqual(['C3'])
    expect(select(VILLAGE)).toBeNull()
    expect(data('LATE_PICK_FORM')[section]).toMatchObject({ REGION_CODE: 'R2', MUNIC_CODE: 'M3', COMMUN_CODE: undefined })
    expect(rootFetches('REGIONS')).toBe(regionFetches)
    expect(pageErrors).toEqual([])
  })

  it('changes the root of a chain walked to its end without drawing it again', async () => {
    mount({ id: 'WALKED_CHAIN_FORM', method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: {}, inputWrapper: Wrapper })
    await until(() => expect(options(REGION)).toEqual(['R1', 'R2']))
    const regionOptions = select(REGION).options.length
    pick(REGION, 'R1')
    await until(() => expect(options(MUNIC)).toEqual(['M1', 'M2']))
    pick(MUNIC, 'M1')
    await until(() => expect(options(COMMUN)).toEqual(['C1']))
    pick(COMMUN, 'C1')
    await until(() => expect(options(VILLAGE)).toEqual(['V1']))
    pick(VILLAGE, 'V1')
    await until(() => expect(data('WALKED_CHAIN_FORM')[section].VILLAGE_CODE).toBe('V1'))
    // rjsf's change event for another field hands GenericForm a copy of every section
    type(container.querySelector('[id="root_holding.basic_ADDRESS"]'), 'Street 10')
    await until(() => expect(data('WALKED_CHAIN_FORM')['holding.basic'].ADDRESS).toBe('Street 10'))
    const regionFetches = rootFetches('REGIONS')

    pick(REGION, 'R2')
    await until(() => expect(options(MUNIC)).toEqual(['M3']))
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(rootFetches('REGIONS')).toBe(regionFetches)
    expect(get.mock.calls.filter(([url]) => url.includes('MUNICIPALITIES/parent-code-value/R1'))).toHaveLength(1)
    expect(select(REGION).value).toBe('R2')
    expect(select(REGION).options.length).toBe(regionOptions)
    expect(data('WALKED_CHAIN_FORM')[section]).toMatchObject({ REGION_CODE: 'R2', MUNIC_CODE: undefined, COMMUN_CODE: undefined, VILLAGE_CODE: undefined })
    expect(pageErrors).toEqual([])
  })

  const labRequest = { type: 'object', properties: { LAB_OBJ_ID: { type: 'string', title: 'Laboratory' }, DEPARTMENT: { type: 'string', title: 'Department' } } }
  const arrayMethod = { type: 'object', properties: { LAB_REQUEST: { type: 'array', items: labRequest, minItems: 1 } } }
  const arrayUiSchema = {
    LAB_REQUEST: {
      items: {
        LAB_OBJ_ID: { 'ui:widget': 'DependencyDropdown', codelistName: 'LABS', order: 0 },
        DEPARTMENT: { 'ui:widget': 'hidden', dependentOnField: 'LAB_OBJ_ID', codelistName: 'LAB_DEPT', order: 1 }
      }
    }
  }

  it('shows a record that arrives after the form has drawn an empty array row', async () => {
    mount({ id: 'LATE_ARRAY_FORM', method: arrayMethod, uiSchemaConfigMethod: arrayUiSchema, tableFormDataMethod: undefined })
    await until(() => expect(options('root_LAB_REQUEST_0_LAB_OBJ_ID')).toEqual(['L1', 'L2']))

    arrive('LATE_ARRAY_FORM', { LAB_REQUEST: [{ LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }] })
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L2')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D2')
    })
    expect(pageErrors).toEqual([])
  })

  it('redraws a row moved up by removing the one above under its new ids, and writes picks into it', async () => {
    const rows = { LAB_REQUEST: [{ LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }, { LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }] }
    mount({ id: 'MOVED_ROW_FORM', method: arrayMethod, uiSchemaConfigMethod: arrayUiSchema, tableFormDataMethod: rows })
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D2'))

    container.querySelectorAll('.array-item-remove')[0].click()
    await until(() => expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID')).not.toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.querySelector('select[id^="root_LAB_REQUEST_1_"]')).toBeNull()
    const moved = data('MOVED_ROW_FORM').LAB_REQUEST
    expect(moved).toEqual([{ LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }])
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L2')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D2')
    })

    pick('root_LAB_REQUEST_0_LAB_OBJ_ID', 'L1')
    await until(() => expect(options('root_LAB_REQUEST_0_DEPARTMENT')).toEqual(['D1']))
    expect(data('MOVED_ROW_FORM').LAB_REQUEST).toEqual([expect.objectContaining({ LAB_OBJ_ID: 'L1' })])
    expect(pageErrors).toEqual([])
  })

  it('redraws both rows under their new ids, with their own values, when a row moves down', async () => {
    const rows = { LAB_REQUEST: [{ LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }, { LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }] }
    mount({ id: 'REORDERED_ROWS_FORM', method: arrayMethod, uiSchemaConfigMethod: arrayUiSchema, tableFormDataMethod: rows })
    await until(() => expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D2'))

    container.querySelectorAll('.array-item-move-down')[0].click()
    await until(() => expect(data('REORDERED_ROWS_FORM').LAB_REQUEST[0].LAB_OBJ_ID).toBe('L2'))
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L2')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D2')
      expect(select('root_LAB_REQUEST_1_LAB_OBJ_ID').value).toBe('L1')
      expect(select('root_LAB_REQUEST_1_DEPARTMENT')?.value).toBe('D1')
    })
    expect(data('REORDERED_ROWS_FORM').LAB_REQUEST).toEqual([{ LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }, { LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1' }])
    expect(pageErrors).toEqual([])
  })

  it('draws an external chain, which loads its own schemas, from the form data its parent passes later', async () => {
    const tree = (props) => h(Provider, { store },
      h(IntlProvider, { locale: 'en', messages: {}, onError: () => {} },
        h(DependencyDropdown, { tableName: 'HOLDING', ...props })))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(tree({}))
    await until(() => expect(options(REGION)).toEqual(['R1', 'R2']))

    root.render(tree({ formData: structuredClone(record) }))
    await until(() => {
      expect(select(REGION).value).toBe('R1')
      expect(select(VILLAGE)?.value).toBe('V1')
    })

    pick(REGION, 'R2')
    await until(() => expect(options(MUNIC)).toEqual(['M3']))
    expect(select(COMMUN)).toBeNull()
    root.render(tree({ formData: structuredClone(record) }))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(select(REGION).value).toBe('R2')
    expect(options(MUNIC)).toEqual(['M3'])
    expect(pageErrors).toEqual([])
  })
})

describe('GenericForm DependentMultiSelectPicker', { timeout: 15000 }, () => {
  const method = {
    type: 'object',
    properties: {
      scope: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            REGION_CODE: { type: 'string', title: 'Region' },
            VILLAGE_CODE: { type: 'string', title: 'Village' },
            HOLDING_OBJ_IDS: { type: 'array', title: 'Holdings', uniqueItems: true, items: { type: 'integer' } }
          }
        }
      }
    }
  }
  const picker = {
    'ui:widget': 'DependentMultiSelectPicker',
    'ui:placeholder': 'Pick first',
    dependentOnField: 'VILLAGE_CODE',
    fieldListUrl: '/Ws/fields/SID/H',
    dataUrl: '/Ws/picker/SID/{VILLAGE_CODE}',
    valueField: 'H.OBJECT_ID',
    selectAllByDefault: true
  }
  const uiSchema = {
    scope: {
      items: {
        REGION_CODE: { 'ui:widget': 'DependencyDropdown', codelistName: 'REGIONS', order: 0 },
        VILLAGE_CODE: { 'ui:widget': 'hidden', dependentOnField: 'REGION_CODE', codelistName: 'VILLAGES', order: 1 },
        HOLDING_OBJ_IDS: picker
      }
    }
  }
  const columns = [{ key: 'H.PIC', name: 'PIC', filterable: true, sortable: true, resizable: true, width: 150 }]
  const villages = { R1: ['V1', 'V2', 'V3', 'V4'], R2: ['V5'] }
  const rowsFor = (ids, pic = (id) => `P-${id}`) => ids.map((id) => ({ 'H.PKID': id * 10, 'H.OBJECT_ID': id, 'H.PIC': pic(id) }))
  const holdings = {
    V1: rowsFor([11, 12, 13]),
    V2: rowsFor([21, 22]),
    V3: [],
    V4: rowsFor([41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52], (id) => (id % 2 ? `ODD-${id}` : `EVEN-${id}`)),
    V5: rowsFor([51])
  }
  const held = {}
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get
  let viewportHeight

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    // happy-dom lays nothing out, and the grid's virtualizer draws only the rows that fit its viewport
    viewportHeight = vi.spyOn(window.HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
      return this.classList.contains('perun-grid-viewport') ? 1000 : 0
    })
    get = vi.spyOn(axios, 'get').mockImplementation((url) => {
      if (url.includes('/Ws/fields/')) {
        return Promise.resolve({ data: columns })
      }
      if (url.includes('/Ws/picker/')) {
        const village = url.split('/').pop()
        const answer = { data: holdings[village] || [] }
        return held[village] ? held[village].then(() => answer) : Promise.resolve(answer)
      }
      if (url.includes('getDependentDropdown')) {
        const values = villages[url.split('/').pop()] || []
        return Promise.resolve({ data: { data: { items: values.map((v, i) => ({ object_id: i + 1, CODE_VALUE: v, LBL_TRANSL: v })) } } })
      }
      return Promise.resolve({ data: ['R1', 'R2'].map((v, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': v, 'SVAROG_CODES.LABEL_CODE': v })) })
    })
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    viewportHeight.mockRestore()
    Object.keys(held).forEach((key) => delete held[key])
    root.unmount()
    container.remove()
  })

  const select = (id) => container.querySelector(`select[id="${id}"]`)
  const row = (formId, i) => ComponentManager.getStateForComponent(formId, 'formTableData')?.scope?.[i]
  const picks = (formId, i) => row(formId, i)?.HOLDING_OBJ_IDS
  const pickerOf = (i) => container.querySelector(`[id="root_scope_${i}_HOLDING_OBJ_IDS"]`)
  const gridRows = (el) => Array.from(el?.querySelectorAll('.perun-grid-row') ?? [])
  const shownIn = (el) => gridRows(el).map((r) => r.querySelector('.perun-grid-cell:not(.perun-grid-cell--select)').textContent)
  const boxesIn = (el) => gridRows(el).map((r) => r.querySelector('.perun-grid-cell--select input'))
  const shown = (i) => shownIn(pickerOf(i))
  const boxes = (i) => boxesIn(pickerOf(i))
  const allBox = (i) => pickerOf(i).querySelector('[data-part="select-all"] input')
  const ticked = (i) => boxes(i).map((box) => box.checked)
  const pickerCalls = () => get.mock.calls.map(([url]) => url).filter((url) => url.includes('/Ws/picker/'))

  async function load (id, formData = {}, ui = uiSchema) {
    mount({ id, method, uiSchemaConfigMethod: ui, tableFormDataMethod: formData })
    await until(() => expect(container.querySelector('[id="root_scope"] .array-item-add button')).not.toBeNull())
  }

  async function addRow (i) {
    const adds = container.querySelectorAll('[id="root_scope"] .array-item-add button')
    adds[adds.length - 1].click()
    await until(() => expect(select(`root_scope_${i}_REGION_CODE`)).not.toBeNull())
  }

  function pick (id, value) {
    const el = select(id)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }

  async function pickVillage (formId, i, region, village) {
    if (select(`root_scope_${i}_REGION_CODE`).value !== region) {
      pick(`root_scope_${i}_REGION_CODE`, region)
      await until(() => expect(select(`root_scope_${i}_VILLAGE_CODE`)).not.toBeNull())
    }
    pick(`root_scope_${i}_VILLAGE_CODE`, village)
    await until(() => expect(row(formId, i)?.VILLAGE_CODE).toBe(village))
  }

  it('waits on a new row, without a request and without dropping the row', async () => {
    await load('PICKER_NEW_ROW_FORM')
    await addRow(0)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(pickerOf(0).textContent).toBe('Pick first')
    expect(pickerCalls()).toEqual([])
    expect(ComponentManager.getStateForComponent('PICKER_NEW_ROW_FORM', 'formTableData').scope).toHaveLength(1)
    expect(pageErrors).toEqual([])
  })

  it('loads the rows for the row\'s value into a grid with the field list\'s columns, and ticks all of them', async () => {
    await load('PICKER_LOAD_FORM')
    await addRow(0)
    await pickVillage('PICKER_LOAD_FORM', 0, 'R1', 'V1')
    await until(() => expect(picks('PICKER_LOAD_FORM', 0)).toEqual([11, 12, 13]))
    await until(() => expect(ticked(0)).toEqual([true, true, true]))
    expect(pickerCalls()).toEqual(['http://backend/Ws/picker/SID/V1'])
    expect(get.mock.calls.map(([url]) => url)).toContain('http://backend/Ws/fields/SID/H')
    expect(shown(0)).toEqual(['P-11', 'P-12', 'P-13'])
    expect(pickerOf(0).querySelector('[role="columnheader"]:not([data-part="select-all"])').textContent).toContain('PIC')
    expect(allBox(0).checked).toBe(true)
    expect(row('PICKER_LOAD_FORM', 0).REGION_CODE).toBe('R1')
    expect(pageErrors).toEqual([])
  })

  it('keeps an untick, and ticks everything again for another village', async () => {
    await load('PICKER_CHANGE_FORM')
    await addRow(0)
    await pickVillage('PICKER_CHANGE_FORM', 0, 'R1', 'V1')
    await until(() => expect(ticked(0)).toEqual([true, true, true]))

    boxes(0)[1].click()
    await until(() => expect(picks('PICKER_CHANGE_FORM', 0)).toEqual([11, 13]))
    expect(ticked(0)).toEqual([true, false, true])

    await pickVillage('PICKER_CHANGE_FORM', 0, 'R1', 'V2')
    await until(() => expect(picks('PICKER_CHANGE_FORM', 0)).toEqual([21, 22]))
    await until(() => expect(shown(0)).toEqual(['P-21', 'P-22']))
    await until(() => expect(ticked(0)).toEqual([true, true]))
    expect(row('PICKER_CHANGE_FORM', 0).VILLAGE_CODE).toBe('V2')
    expect(pageErrors).toEqual([])
  })

  it('clears when the field it depends on is cleared, and keeps the root change that cleared it', async () => {
    await load('PICKER_CLEAR_FORM')
    await addRow(0)
    await pickVillage('PICKER_CLEAR_FORM', 0, 'R1', 'V1')
    await until(() => expect(ticked(0)).toEqual([true, true, true]))

    pick('root_scope_0_REGION_CODE', 'R2')
    await until(() => expect(picks('PICKER_CLEAR_FORM', 0)).toEqual([]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(row('PICKER_CLEAR_FORM', 0).REGION_CODE).toBe('R2')
    expect(row('PICKER_CLEAR_FORM', 0).VILLAGE_CODE).toBeUndefined()
    expect(gridRows(pickerOf(0))).toEqual([])
    expect(pickerOf(0).textContent).toBe('Pick first')
    expect(pageErrors).toEqual([])
  })

  it('drops the answer for a village that is no longer picked', async () => {
    let release
    held.V1 = new Promise((resolve) => { release = resolve })
    await load('PICKER_STALE_FORM')
    await addRow(0)
    await pickVillage('PICKER_STALE_FORM', 0, 'R1', 'V1')
    await pickVillage('PICKER_STALE_FORM', 0, 'R1', 'V2')
    await until(() => expect(picks('PICKER_STALE_FORM', 0)).toEqual([21, 22]))
    await until(() => expect(shown(0)).toEqual(['P-21', 'P-22']))

    release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(picks('PICKER_STALE_FORM', 0)).toEqual([21, 22])
    expect(shown(0)).toEqual(['P-21', 'P-22'])
    expect(pageErrors).toEqual([])
  })

  it('gives each row its own grid and selection', async () => {
    await load('PICKER_ROWS_FORM')
    await addRow(0)
    await pickVillage('PICKER_ROWS_FORM', 0, 'R1', 'V1')
    await until(() => expect(ticked(0)).toEqual([true, true, true]))
    boxes(0)[0].click()
    await until(() => expect(picks('PICKER_ROWS_FORM', 0)).toEqual([12, 13]))

    await addRow(1)
    await pickVillage('PICKER_ROWS_FORM', 1, 'R1', 'V2')
    await until(() => expect(picks('PICKER_ROWS_FORM', 1)).toEqual([21, 22]))
    await until(() => expect(ticked(1)).toEqual([true, true]))
    expect(picks('PICKER_ROWS_FORM', 0)).toEqual([12, 13])
    expect(shown(0)).toEqual(['P-11', 'P-12', 'P-13'])
    expect(ticked(0)).toEqual([false, true, true])
    expect(pageErrors).toEqual([])
  })

  it('unticks and ticks only the rows the grid\'s filter shows, and Enter in the filter doesn\'t submit', async () => {
    await load('PICKER_FILTER_FORM')
    await addRow(0)
    await pickVillage('PICKER_FILTER_FORM', 0, 'R1', 'V4')
    await until(() => expect(boxes(0)).toHaveLength(12))
    await until(() => expect(picks('PICKER_FILTER_FORM', 0)).toHaveLength(12))

    pickerOf(0).querySelector('[data-action="toggle-filters"]').click()
    await until(() => expect(pickerOf(0).querySelector('[data-part="filters"] input[type="text"]')).not.toBeNull())
    const filter = pickerOf(0).querySelector('[data-part="filters"] input[type="text"]')
    const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    filter.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)

    type(filter, 'odd')
    await until(() => expect(shown(0)).toHaveLength(6))
    allBox(0).click()
    await until(() => expect(picks('PICKER_FILTER_FORM', 0)).toEqual([42, 44, 46, 48, 50, 52]))
    allBox(0).click()
    await until(() => expect(picks('PICKER_FILTER_FORM', 0)).toHaveLength(12))
    expect(picks('PICKER_FILTER_FORM', 0)[0]).toBe(41)
    expect(pageErrors).toEqual([])
  })

  it('shows the grid\'s empty view for a village with nothing to pick', async () => {
    await load('PICKER_EMPTY_FORM')
    await addRow(0)
    await pickVillage('PICKER_EMPTY_FORM', 0, 'R1', 'V3')
    await until(() => expect(pickerOf(0).querySelector('[data-part="empty"]')).not.toBeNull())
    expect(picks('PICKER_EMPTY_FORM', 0) ?? []).toEqual([])
    expect(pageErrors).toEqual([])
  })

  it('keeps what a saved row already holds', async () => {
    await load('PICKER_SAVED_FORM', { scope: [{ REGION_CODE: 'R1', VILLAGE_CODE: 'V1', HOLDING_OBJ_IDS: [12] }] })
    await until(() => expect(shown(0)).toEqual(['P-11', 'P-12', 'P-13']))
    await until(() => expect(ticked(0)).toEqual([false, true, false]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(picks('PICKER_SAVED_FORM', 0)).toEqual([12])
    expect(pageErrors).toEqual([])
  })

  it('shows only the picked rows, with nothing to tick, when read only', async () => {
    const readonly = { scope: { items: { ...uiSchema.scope.items, HOLDING_OBJ_IDS: { ...picker, 'ui:readonly': true } } } }
    await load('PICKER_READONLY_FORM', { scope: [{ REGION_CODE: 'R1', VILLAGE_CODE: 'V1', HOLDING_OBJ_IDS: [12, 13] }] }, readonly)
    await until(() => expect(shown(0)).toEqual(['P-12', 'P-13']))
    expect(pickerOf(0).querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(picks('PICKER_READONLY_FORM', 0)).toEqual([12, 13])
    expect(pageErrors).toEqual([])
  })

  it('works in a section, and keeps the root change that clears it', async () => {
    const sectioned = { type: 'object', properties: { 'cp.scope': method.properties.scope.items } }
    const ui = { 'cp.scope': uiSchema.scope.items }
    const section = () => ComponentManager.getStateForComponent('PICKER_SECTION_FORM', 'formTableData')?.['cp.scope']
    const box = () => container.querySelector('[id="root_cp.scope_HOLDING_OBJ_IDS"]')
    mount({ id: 'PICKER_SECTION_FORM', method: sectioned, uiSchemaConfigMethod: ui, tableFormDataMethod: {} })
    await until(() => expect(select('root_cp.scope_REGION_CODE')).not.toBeNull())
    pick('root_cp.scope_REGION_CODE', 'R1')
    await until(() => expect(select('root_cp.scope_VILLAGE_CODE')).not.toBeNull())
    pick('root_cp.scope_VILLAGE_CODE', 'V2')
    await until(() => expect(section()?.HOLDING_OBJ_IDS).toEqual([21, 22]))
    await until(() => expect(boxesIn(box())).toHaveLength(2))

    pick('root_cp.scope_REGION_CODE', 'R2')
    await until(() => expect(section()?.HOLDING_OBJ_IDS).toEqual([]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(section().REGION_CODE).toBe('R2')
    expect(section().VILLAGE_CODE).toBeUndefined()
    expect(pageErrors).toEqual([])
  })
})

describe('GenericForm read-only DependencyDropdown chains and dates', { timeout: 15000 }, () => {
  const method = {
    type: 'object',
    properties: {
      DATE: { type: 'string', format: 'date', title: 'Date' },
      LAB_OBJ_ID: { type: 'string', title: 'Laboratory' },
      DEPARTMENT: { type: 'string', title: 'Department' },
      TEST_TYPE: { type: 'string', title: 'Test type' },
      METHOD: { type: 'string', title: 'Method' }
    }
  }
  // As the lims Retest form has it: the chain is locked down to the test type, the method stays editable
  const uiSchema = {
    DATE: { 'ui:widget': 'CustomDateWithNowButton', 'ui:readonly': true },
    LAB_OBJ_ID: { 'ui:widget': 'DependencyDropdown', codelistName: 'LABS', order: 0, 'ui:readonly': true },
    DEPARTMENT: { 'ui:widget': 'hidden', dependentOnField: 'LAB_OBJ_ID', codelistName: 'LAB_DEPT', order: 1, 'ui:readonly': true },
    TEST_TYPE: { 'ui:widget': 'hidden', dependentOnField: 'DEPARTMENT', codelistName: 'TEST_TYPE', order: 2, 'ui:readonly': true },
    METHOD: { 'ui:widget': 'hidden', dependentOnField: 'TEST_TYPE', codelistName: 'LAB_METHOD', order: 3 }
  }
  const editable = Object.fromEntries(Object.entries(uiSchema).map(([key, ui]) => [key, omit(ui, 'ui:readonly')]))
  const record = { DATE: '2026-01-01', LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1', TEST_TYPE: 'T1', METHOD: 'M1' }
  const roots = { LABS: ['L1', 'L2'] }
  const children = {
    LAB_DEPT: { L1: ['D1'], L2: ['D2'] },
    TEST_TYPE: { D1: ['T1', 'T2'] },
    LAB_METHOD: { T1: ['M1', 'M2'], T2: ['M3'] }
  }
  const CHAIN = ['LAB_OBJ_ID', 'DEPARTMENT', 'TEST_TYPE', 'METHOD']
  const pageErrors = []
  const onError = (event) => pageErrors.push(event.error)
  let get

  beforeEach(() => {
    pageErrors.length = 0
    window.addEventListener('error', onError)
    get = vi.spyOn(axios, 'get').mockImplementation((url) => {
      const root = url.match(/PARENT_CODE_VALUE\/([^/]+)\//)?.[1]
      if (root) {
        return Promise.resolve({ data: (roots[root] || []).map((v, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': v, 'SVAROG_CODES.LABEL_CODE': v })) })
      }
      const [, codelist, parent] = url.match(/codelist-name\/([^/]+)\/parent-code-value\/([^/]+)$/) || []
      const values = children[codelist]?.[parent] || []
      return Promise.resolve({ data: { data: { items: values.map((v, i) => ({ object_id: i + 1, CODE_VALUE: v, LBL_TRANSL: v })) } } })
    })
  })

  afterEach(() => {
    window.removeEventListener('error', onError)
    get.mockRestore()
    root.unmount()
    container.remove()
  })

  const select = (key) => container.querySelector(`select[id="root_${key}"]`)
  const now = () => container.querySelector('.custom-date-btn')
  const data = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')
  const locks = () => Object.fromEntries(CHAIN.map((key) => [key, select(key)?.disabled]))

  async function load (props) {
    mount({ method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: record, inputWrapper: Wrapper, ...props })
    await until(() => CHAIN.forEach((key) => expect(select(key)?.value).toBe(record[key])))
  }

  function pick (key, value) {
    const el = select(key)
    el.value = value
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }

  it('locks the root and each level the uiSchema marks read only, and leaves the method editable', async () => {
    await load({ id: 'READONLY_CHAIN_FORM' })
    expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: false })

    pick('METHOD', 'M2')
    await until(() => expect(data('READONLY_CHAIN_FORM').METHOD).toBe('M2'))
    expect(data('READONLY_CHAIN_FORM')).toMatchObject({ LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1', TEST_TYPE: 'T1' })
    expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: false })
    expect(pageErrors).toEqual([])
  })

  it('locks a level that ui:options or the schema marks read only', async () => {
    const schemaLocked = { ...method, properties: { ...method.properties, DEPARTMENT: { ...method.properties.DEPARTMENT, readOnly: true } } }
    const optionsLocked = { ...editable, TEST_TYPE: { ...editable.TEST_TYPE, 'ui:options': { readonly: true } } }
    await load({ id: 'READONLY_OPTIONS_FORM', method: schemaLocked, uiSchemaConfigMethod: optionsLocked })
    expect(locks()).toEqual({ LAB_OBJ_ID: false, DEPARTMENT: true, TEST_TYPE: true, METHOD: false })
    expect(pageErrors).toEqual([])
  })

  it('locks the whole chain while the form is disabled, and frees it again', async () => {
    await load({ id: 'DISABLED_CHAIN_FORM', uiSchemaConfigMethod: editable, disabled: true })
    expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: true })

    wrapper.formInstance.setState({ disabled: false })
    await until(() => expect(locks()).toEqual({ LAB_OBJ_ID: false, DEPARTMENT: false, TEST_TYPE: false, METHOD: false }))
    wrapper.formInstance.setState({ disabled: true })
    await until(() => expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: true }))
    CHAIN.forEach((key) => expect(select(key).value).toBe(record[key]))
    expect(pageErrors).toEqual([])
  })

  it('disables NOW beside a read-only date, and keeps it working beside an editable one', async () => {
    await load({ id: 'READONLY_DATE_FORM' })
    expect(now().disabled).toBe(true)
    now().click()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(data('READONLY_DATE_FORM').DATE).toBe('2026-01-01')
    root.unmount()
    container.remove()

    await load({ id: 'EDITABLE_DATE_FORM', uiSchemaConfigMethod: editable })
    expect(now().disabled).toBe(false)
    now().click()
    await until(() => expect(data('EDITABLE_DATE_FORM').DATE).toBe(new Date().toISOString().slice(0, 10)))
    expect(pageErrors).toEqual([])
  })
})
