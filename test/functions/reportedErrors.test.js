import { describe, expect, it } from 'vitest'
import { markReported, wasReported } from '../../frontend/functions/reportedErrors'

describe('markReported and wasReported', () => {
  it('know the error, its response and its data, whichever a caller passes on', () => {
    const error = { response: { status: 401, data: { title: 'Session expired' } } }
    markReported(error)
    expect(wasReported(error)).toBe(true)
    expect(wasReported(error.response)).toBe(true)
    expect(wasReported(error.response.data)).toBe(true)
  })

  it('know nothing else', () => {
    expect(wasReported({ response: { status: 401 } })).toBe(false)
    expect(wasReported(undefined)).toBe(false)
    expect(wasReported('Session expired')).toBe(false)
  })

  it('take an error whose data is text, or that has no response', () => {
    const textual = { response: { status: 502, data: '<html>Bad Gateway</html>' } }
    markReported(textual)
    expect(wasReported(textual.response)).toBe(true)
    expect(wasReported(textual.response.data)).toBe(false)

    const bare = new Error('no response')
    markReported(bare)
    expect(wasReported(bare)).toBe(true)
  })
})
