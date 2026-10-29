import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// config.js reads window.server when it loads.
vi.hoisted(() => { globalThis.window = { server: 'http://backend' } })
vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('axios-retry', () => ({ default: vi.fn() }))
vi.mock('../../frontend/model/index.js', () => ({ store: { dispatch: vi.fn() } }))

import axios from 'axios'
import { store } from '../../frontend/model/index.js'
import { busyToFalse, dataToRedux, dataToReduxMain } from '../../frontend/model/dataToRedux'
import { markReported } from '../../frontend/functions/reportedErrors'

describe('busyToFalse', () => {
  it("clears the verb's busy flag", () => {
    expect(busyToFalse('labels', 'MAIN_LABELS')).toEqual({
      type: 'labels/MAIN_LABELS_ACTION_IS_NOW_FALSE',
      overrideStatus: true,
      payload: { isBusy: false }
    })
  })
})

describe('dataToReduxMain', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    axios.get.mockReset()
    store.dispatch.mockReset()
  })

  it("fills the verb's %s placeholders in order and asks the server", async () => {
    axios.get.mockResolvedValue({ data: { title: 'Form' } })

    const action = dataToReduxMain(null, 'docs', 'schema', 'GET_FORM_JSON', 'session', 'FORM_A')

    expect(axios.get).toHaveBeenCalledWith('http://backend/ReactElements/getFormJSONSchema/session/FORM_A', { timeout: 10000 })
    expect(action.type).toBe('docs/GET_FORM_JSON')
    expect(action.payload.isBusy).toBe(true)
    expect(await action.payload.schema).toEqual({ title: 'Form' })
  })

  it('hands the data to the callback and clears the busy flag', async () => {
    axios.get.mockResolvedValue({ data: { title: 'Form' } })
    const callback = vi.fn()

    await dataToReduxMain(callback, 'docs', 'schema', 'GET_FORM_JSON', 'session', 'FORM_A').payload.schema

    expect(callback).toHaveBeenCalledWith({ title: 'Form' })
    expect(store.dispatch).toHaveBeenCalledWith(busyToFalse('docs', 'GET_FORM_JSON'))
  })

  it('does not hand the callback data that is an Error', async () => {
    axios.get.mockResolvedValue({ data: new Error('server said no') })
    const callback = vi.fn()

    await dataToReduxMain(callback, 'docs', 'schema', 'GET_FORM_JSON', 'session', 'FORM_A').payload.schema

    expect(callback).not.toHaveBeenCalled()
  })

  it('resolves with undefined, and hands the callback undefined, when the interceptor has shown the failure', async () => {
    const shown = Object.assign(new Error('Request failed with status code 401'), { response: { status: 401, data: {} } })
    markReported(shown)
    axios.get.mockRejectedValue(shown)
    const callback = vi.fn()

    const data = await dataToReduxMain(callback, 'docs', 'schema', 'GET_FORM_JSON', 'session', 'FORM_A').payload.schema

    expect(data).toBeUndefined()
    expect(callback).toHaveBeenCalledWith(undefined)
    expect(store.dispatch).toHaveBeenCalledWith(busyToFalse('docs', 'GET_FORM_JSON'))
    expect(console.log).not.toHaveBeenCalled()
  })

  it('hands MAIN_VALIDATE undefined too when the interceptor has shown the failure', async () => {
    const shown = Object.assign(new Error('Request failed with status code 503'), { response: { status: 503, data: {} } })
    markReported(shown)
    axios.get.mockRejectedValue(shown)
    const callback = vi.fn()

    await dataToReduxMain(callback, 'security', 'validation', 'MAIN_VALIDATE', 'token').payload.validation

    expect(callback).toHaveBeenCalledWith(undefined)
  })

  it('rethrows a failed request, after clearing the busy flag', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'))
    const callback = vi.fn()

    const action = dataToReduxMain(callback, 'docs', 'schema', 'GET_FORM_JSON', 'session', 'FORM_A')

    await expect(action.payload.schema).rejects.toThrow('Network Error')
    expect(store.dispatch).toHaveBeenCalledWith(busyToFalse('docs', 'GET_FORM_JSON'))
    expect(callback).not.toHaveBeenCalled()
  })

  it('hands MAIN_VALIDATE its failure, so the app goes on loading', async () => {
    const failure = new Error('Network Error')
    axios.get.mockRejectedValue(failure)
    const callback = vi.fn()

    const action = dataToReduxMain(callback, 'security', 'validation', 'MAIN_VALIDATE', 'token')

    await expect(action.payload.validation).rejects.toThrow('Network Error')
    expect(callback).toHaveBeenCalledWith(failure)
  })

  it('sends only the busy flag for MAIN_LABELS', () => {
    axios.get.mockResolvedValue({ data: {} })
    expect(dataToReduxMain(null, 'labels', 'labels', 'MAIN_LABELS', 'en_US', 'perun').payload).toEqual({ isBusy: true })
    expect(axios.get).toHaveBeenCalledWith('http://backend/SvSecurity/i18n/en_US/perun', { timeout: 10000 })
  })

  it('takes anything that is not a verb as the data itself, without a request', () => {
    expect(dataToReduxMain(null, 'menu', 'items', [1, 2])).toEqual({
      type: 'menu/PURE_DATA_FOR_items',
      payload: { items: [1, 2], isBusy: false }
    })
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('spreads FULL_STATE data over the state, leaving out functions and the reserved keys', () => {
    const data = { rows: [1], title: 'T', dispatch: 'd', authData: 'a', children: 'c', onClick: () => {} }
    expect(dataToReduxMain(null, 'grid', 'FULL_STATE', data)).toEqual({
      type: 'grid/PURE_DATA_FOR_FULL_STATE',
      payload: { rows: [1], title: 'T', isBusy: false }
    })
  })
})

describe('dataToRedux', () => {
  it("dispatches dataToReduxMain's action on the store", () => {
    dataToRedux(null, 'menu', 'items', 'not a verb')
    expect(store.dispatch).toHaveBeenCalledWith({
      type: 'menu/PURE_DATA_FOR_items',
      payload: { items: 'not a verb', isBusy: false }
    })
  })
})
