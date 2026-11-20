import { afterEach, beforeEach, expect, vi } from 'vitest'

// config.js reads window.server when it loads. React's production build, as the bundle has: the
// development one redraws on in-place edits that the production one does not.
vi.hoisted(() => {
  window.server = 'http://backend'
  process.env.NODE_ENV = 'production'
})
// The full index reaches client.js, which loads the labels from the server when it loads
vi.mock('../../../../frontend/components/ComponentsIndex', () => ({ Loading: () => null }))

import React from 'react'
import axios from 'axios'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { IntlProvider } from 'react-intl'
import { store } from '../../../../frontend/model'
import { ComponentManager } from '../../../../frontend/elements/ComponentManager'
import GenericForm from '../../../../frontend/elements/form/GenericForm'

export const h = React.createElement

let root
let container
let wrapper

// The production build has no act(), so each step waits for what it should lead to. Generous: the
// first render in a file also loads rjsf and compiles the schema, which is slow on a busy runner.
export const until = (check) => vi.waitFor(check, { timeout: 5000, interval: 10 })

// Before checking that something did not happen, lets what the last step set off run out
export const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

// Returns a function that draws a new element into the same root
export function mount (element) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const draw = (next) => root.render(h(Provider, { store },
    h(IntlProvider, { locale: 'en', messages: {}, onError: () => {} }, next)))
  draw(element)
  return draw
}

export const mountForm = (props) => mount(h(GenericForm, { params: 'FORM_DATA', hideBtns: 'all', ...props }))

export function unmount () {
  root?.unmount()
  container?.remove()
  root = undefined
  container = undefined
}

// Unmounts after each test, and fails a test that threw on the page
export function cleanUpEach () {
  const errors = []
  const onError = (event) => errors.push(event.error)
  beforeEach(() => {
    errors.length = 0
    window.addEventListener('error', onError)
  })
  afterEach(() => {
    unmount()
    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
  })
}

// Stands in for the modules' input wrappers, which get the form instance and write into it
export const Wrapper = (props) => {
  wrapper = props
  return props.children
}
export const formInstance = () => wrapper.formInstance

export const find = (selector) => container.querySelector(selector)
export const findAll = (selector) => container.querySelectorAll(selector)
export const field = (id) => find(`[id="${id}"]`)
export const select = (id) => find(`select[id="${id}"]`)
export const options = (id) => Array.from(select(id)?.options ?? []).map((option) => option.value).filter(Boolean)
export const data = (formId) => ComponentManager.getStateForComponent(formId, 'formTableData')
export const setData = (formId, formData) => ComponentManager.setStateForComponent(formId, 'formTableData', formData)
// The record the form loads, landing in its slice
export const arrive = (formId, record) =>
  store.dispatch({ type: `${formId}_tabledata/FETCH_FORM_TABLE_DATA_FULFILLED`, payload: structuredClone(record) })

export function pick (id, value) {
  const element = select(id)
  element.value = value
  element.dispatchEvent(new window.Event('change', { bubbles: true }))
}

export function type (element, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
}

export const labRequest = {
  type: 'object',
  properties: { LAB_OBJ_ID: { type: 'string', title: 'Laboratory' }, DEPARTMENT: { type: 'string', title: 'Department' } }
}
export const labChain = {
  LAB_OBJ_ID: { 'ui:widget': 'DependencyDropdown', codelistName: 'LABS', order: 0 },
  DEPARTMENT: { 'ui:widget': 'hidden', dependentOnField: 'LAB_OBJ_ID', codelistName: 'LAB_DEPT', order: 1 }
}

const rootAnswer = (values) => ({
  data: values.map((value, i) => ({ 'SVAROG_CODES.OBJECT_ID': i + 1, 'SVAROG_CODES.CODE_VALUE': value, 'SVAROG_CODES.LABEL_CODE': value }))
})
const levelAnswer = (values) => ({
  data: { data: { items: values.map((value, i) => ({ object_id: i + 1, CODE_VALUE: value, LBL_TRANSL: value })) } }
})

// Answers DependencyDropdown's requests from axios.get. roots: the values of each root codelist.
// levels: the values of each codelist below a root, as one list for any parent value, a map by
// parent value, or a function of it. other answers any request first, or returns nothing to pass.
export function serveCodelists ({ roots = {}, levels = {}, other = () => undefined }) {
  return vi.spyOn(axios, 'get').mockImplementation((url) => {
    const answer = other(url)
    if (answer) return Promise.resolve(answer)
    const rootName = url.match(/PARENT_CODE_VALUE\/([^/]+)\//)?.[1]
    if (rootName) return Promise.resolve(rootAnswer(roots[rootName] ?? []))
    const [, codelist, parent] = url.match(/codelist-name\/([^/]+)\/parent-code-value\/([^/]+)$/) ?? []
    const values = levels[codelist]
    const forParent = typeof values === 'function' ? values(parent) : Array.isArray(values) ? values : values?.[parent]
    return Promise.resolve(levelAnswer(forParent ?? []))
  })
}

export const requested = (get) => get.mock.calls.map(([url]) => url)
