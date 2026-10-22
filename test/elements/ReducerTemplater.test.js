import { describe, expect, it } from 'vitest'
import { ReducerTemplater } from '../../frontend/elements/ReducerTemplater'

const reducerFor = (template, id) => ReducerTemplater.generateReducerFromTemplate(template, id)

describe('generateReducerFromTemplate', () => {
  it('answers null for a template it does not have', () => {
    expect(reducerFor('GenericTree', 'x')).toBeNull()
  })
})

describe('GenericGrid', () => {
  const reducer = reducerFor('GenericGrid', 'HOLDINGS_GRID')

  it('starts from an empty state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({})
  })

  it.each([
    ['FETCH_GRID_FULFILLED', { gridConfigLoaded: true, gridConfig: 'P' }],
    ['FETCH_GRID_REJECTED', { gridConfigLoaded: false, gridConfig: 'P' }],
    ['FETCH_GRID_DATA_FULFILLED', { gridDataLoaded: true, gridData: 'P', reloadGrid: false }],
    ['FETCH_GRID_DATA_REJECTED', { gridDataLoaded: false, gridData: 'P' }],
    ['ROW_CLICKED', { rowClicked: 'P' }],
    ['INLINE_EDIT_FULFILLED', { inlineSaveResult: 'P', reloadGrid: true }],
    ['INLINE_EDIT_REJECTED', { inlineSaveResult: 'P', reloadGrid: true }],
    ['INLINE_EDIT_RESET_STATE', { inlineSaveResult: undefined }],
    ['SAVE_ALL_RECORDS_FULFILLED', { saveAllResult: 'P', reloadGrid: true }],
    ['SAVE_ALL_RECORDS_REJECTED', { saveAllResult: 'P', reloadGrid: true }],
    ['SAVE_ALL_RECORDS_RESET_STATE', { saveAllResult: undefined }]
  ])('%s', (type, expected) => {
    const state = { kept: 1 }
    const next = reducer(state, { type: `HOLDINGS_GRID/${type}`, payload: 'P' })
    expect(next).toEqual({ kept: 1, ...expected })
    expect(state).toEqual({ kept: 1 })
  })

  it('merges a published payload', () => {
    expect(reducer({ a: 1, b: 1 }, { type: 'HOLDINGS_GRID/PUBLISH_DATA', payload: { b: 2 } })).toEqual({ a: 1, b: 2 })
  })

  it("ignores another grid's actions", () => {
    const state = { kept: 1 }
    expect(reducer(state, { type: 'OTHER_GRID/ROW_CLICKED', payload: 'P' })).toBe(state)
  })
})

describe('GenericForm', () => {
  const reducer = reducerFor('GenericForm', 'HOLDING_FORM')

  it('takes the form, its table data and its UI schema from their own action types', () => {
    let state = reducer(undefined, { type: 'HOLDING_FORM/FETCH_FORM_FULFILLED', payload: 'schema', payloadExcludedFields: 'excluded' })
    state = reducer(state, { type: 'HOLDING_FORM_tabledata/FETCH_FORM_TABLE_DATA_FULFILLED', payload: 'row' })
    state = reducer(state, { type: 'HOLDING_FORM_uischema/FETCH_FORM_UISCHEMA_FULFILLED', payload: 'ui' })
    expect(state).toEqual({
      formConfigLoaded: true, formWithExcluded: 'excluded', formData: 'schema',
      formDataLoaded: true, formTableData: 'row',
      uischemaLoaded: true, uischema: 'ui'
    })
  })

  it('marks each part failed on its rejection', () => {
    let state = reducer(undefined, { type: 'HOLDING_FORM/FETCH_FORM_REJECTED', payload: 'e1' })
    state = reducer(state, { type: 'HOLDING_FORM_tabledata/FETCH_FORM_TABLE_DATA_REJECTED', payload: 'e2' })
    state = reducer(state, { type: 'HOLDING_FORM_uischema/FETCH_FORM_UISCHEMA_REJECTED', payload: 'e3' })
    expect(state).toMatchObject({
      formConfigLoaded: false, formData: 'e1', formDataLoaded: false, formTableData: 'e2', uischemaLoaded: false, uischema: 'e3'
    })
  })

  it('keeps the latest save result or error, never both', () => {
    const saved = reducer({ saveFormError: 'old' }, {
      type: 'HOLDING_FORM/SAVE_FORM_DATA', payload: 'ok', resType: 'success', title: 'Saved', message: 'Done'
    })
    expect(saved).toEqual({
      saveFormResponse: 'ok', saveFormError: undefined, saveFormType: 'success', saveFormTitle: 'Saved', saveFormMessage: 'Done'
    })

    const rejected = reducer(saved, { type: 'HOLDING_FORM/REJECTED_FORM_DATA', payload: 'failed' })
    expect(rejected).toMatchObject({ saveFormResponse: undefined, saveFormError: 'failed' })
  })
})

describe('parameterComponent', () => {
  const reducer = reducerFor('parameterComponent', 'PARAMS')

  it('records whether the parameter config loaded', () => {
    expect(reducer({}, { type: 'PARAMS/FETCH_PARAMS_CONF_FULFILLED', payload: 'conf' }))
      .toEqual({ paramConfigLoaded: true, paramConfig: 'conf' })
    expect(reducer({}, { type: 'PARAMS/FETCH_PARAMS_CONF_REJECTED', payload: 'e' }))
      .toEqual({ paramConfigLoaded: false, paramConfig: 'e' })
    expect(reducer({}, { type: 'PARAMS/FETCH_PARAMS_REJECTED', payload: 'e' }))
      .toEqual({ paramConfigLoaded: false, paramConfig: 'e' })
  })
})

describe('genericComponent', () => {
  it('merges every action in its namespace', () => {
    const reducer = reducerFor('genericComponent', 'MENU')
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state).toEqual({})
    expect(reducer(state, { type: 'MENU/GET_DATA', payload: { items: [1] } })).toEqual({ items: [1] })
    expect(reducer(state, { type: 'OTHER/GET_DATA', payload: { items: [1] } })).toBe(state)
  })
})
