// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

// config.js reads window.server when it loads. React's production build, as the bundle has: the
// development one redraws on in-place edits that the production one does not.
vi.hoisted(() => {
  window.server = 'http://backend'
  process.env.NODE_ENV = 'production'
})
// The full index reaches client.js, which loads the labels from the server when it loads
vi.mock('../../../frontend/components/ComponentsIndex', () => ({ Loading: () => null }))

import React from 'react'
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

async function renderForm (id) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(h(Provider, { store },
    h(IntlProvider, { locale: 'en', messages: {}, onError: () => {} },
      h(GenericForm, { id, params: 'FORM_DATA', method: schema, uiSchemaConfigMethod: {}, tableFormDataMethod: {}, hideBtns: 'all', inputWrapper: Wrapper }))))
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
})
