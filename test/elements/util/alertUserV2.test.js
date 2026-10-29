import { afterEach, describe, expect, it, vi } from 'vitest'

const fire = vi.hoisted(() => vi.fn(() => Promise.resolve({ isConfirmed: true })))
vi.mock('sweetalert2', () => ({ default: { fire } }))
vi.mock('../../../frontend/functions/utils', () => ({
  isJSON: (value) => {
    if (typeof value === 'object') return value !== null
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null
    } catch {
      return false
    }
  }
}))

import { alertUserResponse } from '../../../frontend/elements/util/alertUserV2'
import { markReported } from '../../../frontend/functions/reportedErrors'

const failed = (status, data) => ({ response: { status, data, headers: {} } })

describe('alertUserResponse', () => {
  afterEach(() => {
    fire.mockClear()
  })

  it("shows the server's title and message for a failure", async () => {
    const onConfirm = vi.fn()
    alertUserResponse({ response: failed(500, { title: 'Save failed', message: 'Try again' }), onConfirm })

    expect(fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error', title: 'Save failed', text: 'Try again' }))
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
  })

  it('stays quiet for a failure the interceptor has shown, however the caller passes it on', () => {
    const error = failed(401, { title: 'Session expired' })
    markReported(error)
    const onConfirm = vi.fn()

    alertUserResponse({ response: error, onConfirm })
    alertUserResponse({ response: error.response, type: 'error' })
    alertUserResponse({ response: error.response.data })

    expect(fire).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
