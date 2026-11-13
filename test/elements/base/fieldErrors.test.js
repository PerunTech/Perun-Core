// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'
import InputElement from '../../../frontend/elements/base/InputElement/InputElement'
import { Dropdown } from '../../../frontend/elements/base/dropdown/Dropdown'

const h = React.createElement
const messages = { 'perun.login.mandatory_login_empty': 'The field cannot be empty' }

const mount = (field) => {
  document.body.innerHTML = renderToStaticMarkup(h(IntlProvider, { locale: 'en', messages, onError: () => {} }, field))
  return document.body
}

describe.each([
  ['InputElement', InputElement, 'input'],
  ['Dropdown', Dropdown, 'select']
])('%s', (_name, Field, tag) => {
  it('shows the error as text the field points to', () => {
    const root = mount(h(Field, { id: 'f', name: 'f', className: 'x', error: 'perun.login.mandatory_login_empty', onChange: () => {} }))
    const field = root.querySelector(tag)
    const message = root.querySelector('.input-error-message')
    expect(message.textContent).toBe('The field cannot be empty')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')).toBe(message.id)
    expect(field.classList.contains('input_error')).toBe(true)
    expect(root.querySelector('.has-error')).not.toBeNull()
  })

  it('shows the key when there is no label for it', () => {
    const root = mount(h(Field, { id: 'f', name: 'f', className: 'x', error: 'perun.login.unknown', onChange: () => {} }))
    expect(root.querySelector('.input-error-message').textContent).toBe('perun.login.unknown')
  })

  it('adds nothing without an error', () => {
    const root = mount(h(Field, { id: 'f', name: 'f', className: 'x', onChange: () => {} }))
    const field = root.querySelector(tag)
    expect(root.querySelector('.input-error-message')).toBeNull()
    expect(field.hasAttribute('aria-invalid')).toBe(false)
    expect(field.hasAttribute('aria-describedby')).toBe(false)
    expect(root.querySelector('.react-tooltip, [data-tooltip-id]')).toBeNull()
  })
})
