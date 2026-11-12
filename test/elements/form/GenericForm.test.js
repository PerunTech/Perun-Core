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
