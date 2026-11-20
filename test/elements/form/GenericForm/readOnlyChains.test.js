// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import omit from 'lodash/omit'
import {
  Wrapper, cleanUpEach, data, find, formInstance, mountForm, pick, serveCodelists, settle, unmount, until
} from './harness.js'

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
const CHAIN = ['LAB_OBJ_ID', 'DEPARTMENT', 'TEST_TYPE', 'METHOD']

describe('GenericForm read-only DependencyDropdown chains and dates', { timeout: 15000 }, () => {
  cleanUpEach()

  beforeEach(() => {
    serveCodelists({
      roots: { LABS: ['L1', 'L2'] },
      levels: {
        LAB_DEPT: { L1: ['D1'], L2: ['D2'] },
        TEST_TYPE: { D1: ['T1', 'T2'] },
        LAB_METHOD: { T1: ['M1', 'M2'], T2: ['M3'] }
      }
    })
  })

  const chainSelect = (key) => find(`select[id="root_${key}"]`)
  const now = () => find('.custom-date-btn')
  const locks = () => Object.fromEntries(CHAIN.map((key) => [key, chainSelect(key)?.disabled]))

  async function load (props) {
    mountForm({ method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: record, inputWrapper: Wrapper, ...props })
    await until(() => CHAIN.forEach((key) => expect(chainSelect(key)?.value).toBe(record[key])))
  }

  it('locks the root and each level the uiSchema marks read only, and leaves the method editable', async () => {
    await load({ id: 'READONLY_CHAIN_FORM' })
    expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: false })

    pick('root_METHOD', 'M2')
    await until(() => expect(data('READONLY_CHAIN_FORM').METHOD).toBe('M2'))
    expect(data('READONLY_CHAIN_FORM')).toMatchObject({ LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1', TEST_TYPE: 'T1' })
    expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: false })
  })

  it('locks a level that ui:options or the schema marks read only', async () => {
    const schemaLocked = { ...method, properties: { ...method.properties, DEPARTMENT: { ...method.properties.DEPARTMENT, readOnly: true } } }
    const optionsLocked = { ...editable, TEST_TYPE: { ...editable.TEST_TYPE, 'ui:options': { readonly: true } } }
    await load({ id: 'READONLY_OPTIONS_FORM', method: schemaLocked, uiSchemaConfigMethod: optionsLocked })
    expect(locks()).toEqual({ LAB_OBJ_ID: false, DEPARTMENT: true, TEST_TYPE: true, METHOD: false })
  })

  it('locks the whole chain while the form is disabled, and frees it again', async () => {
    await load({ id: 'DISABLED_CHAIN_FORM', uiSchemaConfigMethod: editable, disabled: true })
    expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: true })

    formInstance().setState({ disabled: false })
    await until(() => expect(locks()).toEqual({ LAB_OBJ_ID: false, DEPARTMENT: false, TEST_TYPE: false, METHOD: false }))
    formInstance().setState({ disabled: true })
    await until(() => expect(locks()).toEqual({ LAB_OBJ_ID: true, DEPARTMENT: true, TEST_TYPE: true, METHOD: true }))
    CHAIN.forEach((key) => expect(chainSelect(key).value).toBe(record[key]))
  })

  it('disables NOW beside a read-only date, and keeps it working beside an editable one', async () => {
    await load({ id: 'READONLY_DATE_FORM' })
    expect(now().disabled).toBe(true)
    now().click()
    await settle()
    expect(data('READONLY_DATE_FORM').DATE).toBe('2026-01-01')
    unmount()

    await load({ id: 'EDITABLE_DATE_FORM', uiSchemaConfigMethod: editable })
    expect(now().disabled).toBe(false)
    now().click()
    await until(() => expect(data('EDITABLE_DATE_FORM').DATE).toBe(new Date().toISOString().slice(0, 10)))
  })
})
