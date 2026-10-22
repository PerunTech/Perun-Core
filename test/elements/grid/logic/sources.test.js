import { describe, expect, it } from 'vitest'
import { sameValue, sourcesOf } from '../../../../frontend/elements/grid/logic/sources'

describe('sameValue', () => {
  it('compares primitives as Object.is does', () => {
    expect(sameValue('HOLDING', 'HOLDING')).toBe(true)
    expect(sameValue(NaN, NaN)).toBe(true)
    expect(sameValue(1, '1')).toBe(false)
    expect(sameValue(null, undefined)).toBe(false)
  })

  it('compares arrays and plain objects by what they hold, nested', () => {
    const params = () => [{ PARAM_NAME: 'objectId', PARAM_VALUE: 42 }, { PARAM_NAME: 'tags', PARAM_VALUE: ['a', 'b'] }]
    expect(sameValue(params(), params())).toBe(true)
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(sameValue([1, 2], [2, 1])).toBe(false)
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false)
    expect(sameValue([{ PARAM_VALUE: 42 }], [{ PARAM_VALUE: 43 }])).toBe(false)
  })

  it('tells keys apart, even ones holding undefined', () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1, c: undefined })).toBe(false)
    expect(sameValue({ a: undefined }, {})).toBe(false)
  })

  it('does not take an array and an object with the same keys for the same', () => {
    expect(sameValue(['x'], { 0: 'x' })).toBe(false)
    expect(sameValue({ 0: 'x' }, ['x'])).toBe(false)
  })

  it('compares functions and class instances by identity', () => {
    const fn = () => {}
    expect(sameValue(fn, fn)).toBe(true)
    expect(sameValue(fn, () => {})).toBe(false)
    expect(sameValue(new Date(0), new Date(0))).toBe(false)
    expect(sameValue(Object.create(null), Object.create(null))).toBe(false)
  })
})

describe('sourcesOf', () => {
  const params = [{ PARAM_NAME: 'objectId', PARAM_VALUE: 42 }]

  it('keeps the params of a BASE or CUSTOM grid, whose verbs may use them', () => {
    expect(sourcesOf({ gridType: 'BASE', configTableName: 'HOLDING', dataTableName: 'HOLDING', params })).toEqual({
      config: ['BASE', 'HOLDING', params],
      data: ['BASE', 'HOLDING', params]
    })
    expect(sourcesOf({ gridType: 'CUSTOM', configTableName: 'GET_HOLDINGS', dataTableName: 'GET_HOLDINGS', params }).data[2]).toBe(params)
  })

  it('drops the params of a path with no % in it, which cannot use them', () => {
    const sources = sourcesOf({ gridType: 'READ_URL', configTableName: '/ReactElements/config', dataTableName: '/Holdings/%objectId', params })
    expect(sources.config).toEqual(['READ_URL', '/ReactElements/config', undefined])
    expect(sources.data).toEqual(['READ_URL', '/Holdings/%objectId', params])
  })

  it('keeps the params of rows given as they are', () => {
    const rows = [{ NAME: 'Ohrid' }]
    expect(sourcesOf({ gridType: 'SEARCH_GRID_DATA', configTableName: '/config', dataTableName: rows, params }).data).toEqual([
      'SEARCH_GRID_DATA', rows, params
    ])
  })
})
