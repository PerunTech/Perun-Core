import { afterEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, CanceledError } from 'axios'

const push = vi.hoisted(() => vi.fn())
vi.mock('history', () => ({ createHashHistory: () => ({ push }) }))
vi.mock('../../frontend/model/index.js', () => ({ store: { dispatch: vi.fn() } }))
vi.mock('../../frontend/elements/util/alertUserV2', () => ({ alertUserV2: vi.fn(), alertUserResponse: vi.fn() }))

import { store } from '../../frontend/model/index.js'
import { alertUserResponse, alertUserV2 } from '../../frontend/elements/util/alertUserV2'
import { rejectedResponse } from '../../frontend/functions/rejectedResponse'

const withStatus = (status) => new AxiosError('Request failed', 'ERR_BAD_RESPONSE', {}, null, { status, data: {}, headers: {} })

describe('rejectedResponse', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no response, after saying the server is out of reach', async () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')
    await expect(rejectedResponse(error)).rejects.toBe(error)
    expect(alertUserV2).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', title: 'Unable to connect to the server' }))
  })

  it('rejects a cancelled request without a word', async () => {
    const error = new CanceledError()
    await expect(rejectedResponse(error)).rejects.toBe(error)
    expect(alertUserV2).not.toHaveBeenCalled()
  })

  it('rejects any other status untouched, for the caller to report', async () => {
    const error = withStatus(500)
    await expect(rejectedResponse(error)).rejects.toBe(error)
    expect(alertUserV2).not.toHaveBeenCalled()
  })

  it('on 401 goes to the login page, reports the response and logs out, then returns nothing', () => {
    const error = withStatus(401)
    expect(rejectedResponse(error)).toBeUndefined()
    expect(push).toHaveBeenCalledWith('/home/login')
    expect(alertUserResponse).toHaveBeenCalledWith({ response: error.response })
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'LOGOUT_FULFILLED', payload: undefined })
  })

  it.each([302, 502, 503])('on %i alerts and returns nothing', (status) => {
    expect(rejectedResponse(withStatus(status))).toBeUndefined()
    expect(alertUserV2).toHaveBeenCalledOnce()
  })

  it('so a request it handled resolves with undefined, whatever runWhen says', async () => {
    const instance = axios.create({
      adapter: (config) => Promise.reject(new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status: 401, data: {}, headers: {}, config }))
    })
    instance.interceptors.response.use((res) => res, rejectedResponse, { runWhen: () => false })

    expect(await instance.get('/anything')).toBeUndefined()
    expect(push).toHaveBeenCalledWith('/home/login')
  })
})
