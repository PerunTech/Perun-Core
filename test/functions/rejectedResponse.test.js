import { afterEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, CanceledError } from 'axios'
import axiosRetry from 'axios-retry'

const push = vi.hoisted(() => vi.fn())
vi.mock('history', () => ({ createHashHistory: () => ({ push }) }))
vi.mock('../../frontend/model/index.js', () => ({ store: { dispatch: vi.fn() } }))
vi.mock('../../frontend/elements/util/alertUserV2', () => ({ alertUserV2: vi.fn(), alertUserResponse: vi.fn() }))

import { store } from '../../frontend/model/index.js'
import { alertUserResponse, alertUserV2 } from '../../frontend/elements/util/alertUserV2'
import { rejectedResponse } from '../../frontend/functions/rejectedResponse'
import { wasReported } from '../../frontend/functions/reportedErrors'

const withStatus = (status) => new AxiosError('Request failed', 'ERR_BAD_RESPONSE', {}, null, { status, data: {}, headers: {} })

describe('rejectedResponse', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no response, after saying the server is out of reach', async () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')
    await expect(rejectedResponse(error)).rejects.toBe(error)
    expect(alertUserV2).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', title: 'Unable to connect to the server' }))
    expect(wasReported(error)).toBe(false)
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
    expect(wasReported(error)).toBe(false)
  })

  it('on 401 goes to the login page, reports the response and logs out, then rejects it as reported', async () => {
    const error = withStatus(401)
    let markedBeforeAlert
    alertUserResponse.mockImplementationOnce(({ response }) => { markedBeforeAlert = wasReported(response) })
    await expect(rejectedResponse(error)).rejects.toBe(error)
    expect(push).toHaveBeenCalledWith('/home/login')
    expect(alertUserResponse).toHaveBeenCalledWith({ response: error.response })
    expect(markedBeforeAlert).toBe(false)
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'LOGOUT_FULFILLED', payload: undefined })
    expect(wasReported(error)).toBe(true)
  })

  it.each([302, 502, 503])('on %i alerts, then rejects it as reported', async (status) => {
    const error = withStatus(status)
    await expect(rejectedResponse(error)).rejects.toBe(error)
    expect(alertUserV2).toHaveBeenCalledOnce()
    expect(wasReported(error)).toBe(true)
  })

  it('so a request it answered rejects, where it used to resolve with undefined', async () => {
    const instance = axios.create({
      adapter: (config) => Promise.reject(new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status: 401, data: {}, headers: {}, config }))
    })
    instance.interceptors.response.use((res) => res, rejectedResponse)

    const error = await instance.get('/anything').catch(err => err)

    expect(error).toBeInstanceOf(AxiosError)
    expect(wasReported(error)).toBe(true)
    expect(push).toHaveBeenCalledWith('/home/login')
  })

  it.each([
    ['a 503', (config) => new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status: 503, data: {}, headers: {}, config })],
    ['a lost connection', (config) => new AxiosError('Network Error', 'ERR_NETWORK', config, {})]
  ])('answers %s once, though axios-retry hands it back after the retry', async (_, failure) => {
    const adapter = vi.fn((config) => Promise.reject(failure(config)))
    const instance = axios.create({ adapter })
    axiosRetry(instance, { retries: 1, retryDelay: () => 0 })
    instance.interceptors.response.use((res) => res, rejectedResponse)

    await expect(instance.get('/anything')).rejects.toBeInstanceOf(AxiosError)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(alertUserV2).toHaveBeenCalledOnce()
  })
})
