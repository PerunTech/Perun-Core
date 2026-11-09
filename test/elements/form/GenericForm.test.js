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
})
