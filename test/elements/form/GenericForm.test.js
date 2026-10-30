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

// The production build has no act(), so give React a moment to render after each step
async function settle (step) {
  await step()
  await new Promise(resolve => setTimeout(resolve, 30))
}

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

async function renderForm (id) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await settle(async () => {
    root.render(h(Provider, { store },
      h(IntlProvider, { locale: 'en', messages: {}, onError: () => {} },
        h(GenericForm, { id, params: 'FORM_DATA', method: schema, uiSchemaConfigMethod: {}, tableFormDataMethod: {}, hideBtns: 'all', inputWrapper: Wrapper }))))
  })
}

async function addItem () {
  await settle(async () => container.querySelector('.array-item-add').click())
}

async function type (input, value) {
  await settle(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

const input = (id) => container.querySelector(`[id="${id}"]`)

describe('GenericForm', () => {
  afterEach(async () => {
    await settle(async () => root.unmount())
    container.remove()
  })

  it('shows a value a wrapper writes into an array item of formTableData in place', async () => {
    await renderForm('IN_PLACE_FORM')
    await addItem()

    // What the RecordSelectWrapper copies do with a picked row
    const formData = ComponentManager.getStateForComponent('IN_PLACE_FORM', 'formTableData')
    formData.ITEMS[0] = { ...formData.ITEMS[0], ID: 4711, NAME: 'Amoxicillin' }
    await settle(async () => {
      ComponentManager.setStateForComponent('IN_PLACE_FORM', 'formTableData', formData)
      wrapper.formInstance.setState({ formTableData: formData })
      wrapper.formInstance.onInputChange(formData)
    })

    expect(input('root_ITEMS_0_NAME').value).toBe('Amoxicillin')
    expect(input('root_ITEMS_0_ID').value).toBe('4711')

    await type(input('root_ITEMS_0_QTY'), '5')

    expect(input('root_ITEMS_0_NAME').value).toBe('Amoxicillin')
    expect(ComponentManager.getStateForComponent('IN_PLACE_FORM', 'formTableData').ITEMS).toEqual([
      { ID: 4711, NAME: 'Amoxicillin', QTY: 5 }
    ])
  })

  it('takes the form data itself as well as an rjsf change event', async () => {
    await renderForm('PLAIN_DATA_FORM')
    await addItem()

    const current = ComponentManager.getStateForComponent('PLAIN_DATA_FORM', 'formTableData')
    await settle(async () => {
      wrapper.formInstance.onInputChange({ ...current, NOTE: 'picked', ITEMS: [{ ID: 815, NAME: 'Oxytetracycline' }] })
    })

    expect(input('root_NOTE').value).toBe('picked')
    expect(input('root_ITEMS_0_NAME').value).toBe('Oxytetracycline')
  })
})
