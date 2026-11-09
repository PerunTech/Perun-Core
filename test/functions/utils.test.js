// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

// utils.js loads the store, and config.js reads window.server when it loads
vi.hoisted(() => {
  window.server = 'http://backend'
})
vi.mock('../../frontend/components/ComponentsIndex', () => ({ Loading: () => null }))

import { getObjectValueByKey } from '../../frontend/functions/utils'

describe('getObjectValueByKey', () => {
  it('finds a key at the top level or in a nested object', () => {
    expect(getObjectValueByKey({ GPS_NORTH: '41°59\'00\'\'' }, 'GPS_NORTH')).toBe('41°59\'00\'\'')
    expect(getObjectValueByKey({ LOCATION: { COORDS: { GPS_EAST: '21' } } }, 'GPS_EAST')).toBe('21')
    expect(getObjectValueByKey({ ITEMS: [{ NAME: 'a' }, { QTY: 5 }] }, 'QTY')).toBe(5)
  })

  it('returns the first match it comes to', () => {
    expect(getObjectValueByKey({ A: { X: 1 }, B: { X: 2 } }, 'X')).toBe(1)
    expect(getObjectValueByKey({ X: 0, A: { X: 2 } }, 'X')).toBe(0)
  })

  it('returns undefined for a key that is not there', () => {
    expect(getObjectValueByKey({ A: 1, B: { C: 'x' } }, 'X')).toBeUndefined()
  })

  it('returns undefined for missing or non-object data', () => {
    expect(getObjectValueByKey(undefined, 'X')).toBeUndefined()
    expect(getObjectValueByKey(null, 'X')).toBeUndefined()
    expect(getObjectValueByKey('GPS_NORTH', 'GPS_NORTH')).toBeUndefined()
    expect(getObjectValueByKey(5, 'X')).toBeUndefined()
  })

  it('looks past null and other non-object values at any depth', () => {
    expect(getObjectValueByKey({ A: null, B: 'text', C: 3, D: { E: null, X: 'found' } }, 'X')).toBe('found')
    expect(getObjectValueByKey({ A: { B: null } }, 'X')).toBeUndefined()
  })
})
