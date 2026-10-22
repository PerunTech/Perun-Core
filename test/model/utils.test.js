import { afterEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  ConvertObjectKeysToUpperCase, cloneObject, flattenJson, flattenObject, isValidArray, isValidObject,
  replaceSpecialCharsInJson, strcmp, svSessionRegxp, switchServerLanguage
} from '../../frontend/model/utils'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))

describe('svSessionRegxp', () => {
  it('accepts 36 letters, digits, underscores and hyphens', () => {
    expect(svSessionRegxp('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true)
    expect(svSessionRegxp('_'.repeat(36))).toBe(true)
  })

  it('turns away any other length or character', () => {
    expect(svSessionRegxp('f47ac10b-58cc-4372-a567-0e02b2c3d47')).toBe(false)
    expect(svSessionRegxp('f47ac10b-58cc-4372-a567-0e02b2c3d4790')).toBe(false)
    expect(svSessionRegxp('f47ac10b.58cc.4372.a567.0e02b2c3d479')).toBe(false)
    expect(svSessionRegxp(undefined)).toBe(false)
  })
})

describe('flattenJson', () => {
  it('joins nested keys with dots', () => {
    const farmer = { id: 1, farmer: { name: 'Ana', address: { city: 'Skopje' } }, note: null }
    expect(flattenJson(farmer)).toEqual({ id: 1, 'farmer.name': 'Ana', 'farmer.address.city': 'Skopje', note: null })
  })

  it('keeps an empty object or array under its key', () => {
    expect(flattenJson({ a: {}, b: [] })).toEqual({ a: {}, b: [] })
  })

  it("gives an array's elements the array's own key, so the last one wins", () => {
    expect(flattenJson({ tags: ['x', 'y'] })).toEqual({ tags: 'y' })
    expect(flattenJson({ owners: [{ name: 'A', pin: 1 }, { name: 'B' }] })).toEqual({ 'owners.name': 'B', 'owners.pin': 1 })
  })
})

describe('ConvertObjectKeysToUpperCase', () => {
  it('upper-cases keys at every level', () => {
    expect(ConvertObjectKeysToUpperCase({ name: 'a', address: { city: 'b', zip: 1000 } }))
      .toEqual({ NAME: 'a', ADDRESS: { CITY: 'b', ZIP: 1000 } })
  })

  it('keeps only the first element of an array, converted', () => {
    expect(ConvertObjectKeysToUpperCase({ items: [{ id: 1 }, { id: 2 }] })).toEqual({ ITEMS: [{ ID: 1 }] })
  })
})

describe('replaceSpecialCharsInJson', () => {
  it('replaces slashes and backslashes with their placeholders', () => {
    expect(replaceSpecialCharsInJson('a/b\\c//')).toBe('a,P!_1-b,P!_2-c,P!_1-,P!_1-')
  })
})

describe('cloneObject', () => {
  it('copies objects and arrays at every level', () => {
    const original = { a: { b: [1, { c: 2 }] } }
    const clone = cloneObject(original)
    expect(clone).toEqual(original)
    expect(clone.a).not.toBe(original.a)
    expect(clone.a.b).not.toBe(original.a.b)
    expect(clone.a.b[1]).not.toBe(original.a.b[1])
  })

  it('copies dates and keeps class instances on their prototype', () => {
    class Point {
      constructor() { this.x = 0 }
    }
    const point = new Point()
    point.x = 5
    const when = new Date(0)

    const clone = cloneObject({ point, when })

    expect(clone.point).toBeInstanceOf(Point)
    expect(clone.point.x).toBe(5)
    expect(clone.when).not.toBe(when)
    expect(clone.when.getTime()).toBe(0)
  })

  it('returns primitives and null as they are', () => {
    expect(cloneObject(null)).toBeNull()
    expect(cloneObject('a')).toBe('a')
    expect(cloneObject(1)).toBe(1)
  })
})

describe('isValidArray and isValidObject', () => {
  it('isValidArray wants an array of at least the given length', () => {
    expect(isValidArray([])).toBe(true)
    expect(isValidArray([1, 2], 2)).toBe(true)
    expect(isValidArray([1], 2)).toBe(false)
    expect(isValidArray({ length: 1 })).toBe(false)
    expect(isValidArray('ab')).toBe(false)
    expect(isValidArray(null)).toBeFalsy()
  })

  it('isValidObject wants a plain object with at least the given number of keys', () => {
    expect(isValidObject({})).toBe(true)
    expect(isValidObject({ a: 1, b: 2 }, 2)).toBe(true)
    expect(isValidObject({ a: 1 }, 2)).toBe(false)
    expect(isValidObject([])).toBe(false)
    expect(isValidObject(new Date())).toBe(false)
    expect(isValidObject(undefined)).toBeFalsy()
  })
})

describe('strcmp', () => {
  it('compares strings ignoring case and accents', () => {
    expect(strcmp('Ana', 'ana')).toBe(true)
    expect(strcmp('Ana', 'Ána')).toBe(true)
    expect(strcmp(new String('a'), new String('A'))).toBe(true)
    expect(strcmp('a', 'b')).toBe(false)
  })

  it('answers false unless both are strings', () => {
    expect(strcmp('1', 1)).toBe(false)
    expect(strcmp('a', new String('a'))).toBe(false)
    expect(strcmp(null, null)).toBe(false)
  })
})

describe('flattenObject', () => {
  it('lifts nested keys to the top and drops the keys that held them', () => {
    expect(flattenObject({ a: 1, b: { c: 2, d: { e: 3 } }, f: null })).toEqual({ a: 1, c: 2, e: 3, f: null })
  })

  it('lets a later nested key replace an earlier one, and flattens arrays by index', () => {
    expect(flattenObject({ c: 1, b: { c: 2 } })).toEqual({ c: 2 })
    expect(flattenObject({ list: ['x', 'y'] })).toEqual({ 0: 'x', 1: 'y' })
  })
})

describe('switchServerLanguage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    axios.get.mockReset()
  })

  it("asks the server to switch the session's language, and logs a failure", async () => {
    vi.stubGlobal('window', { server: 'http://backend' })
    const failure = new Error('Network Error')
    axios.get.mockRejectedValue(failure)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    switchServerLanguage('mk_MK', 'token')
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(failure))

    expect(axios.get).toHaveBeenCalledWith('http://backend/SvSecurity/i18n/mk_MK/perun/token')
    error.mockRestore()
  })
})
