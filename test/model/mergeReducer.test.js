import { describe, expect, it } from 'vitest'
import createMergeReducer, { merge } from '../../frontend/model/mergeReducer'

describe('merge', () => {
  it('merges plain objects key by key, recursively', () => {
    const current = { grid: { loaded: false, rows: [1] }, title: 'a' }
    expect(merge({ grid: { loaded: true } }, current)).toEqual({ grid: { loaded: true, rows: [1] }, title: 'a' })
  })

  it('replaces arrays, values and class instances', () => {
    const when = new Date(0)
    expect(merge({ rows: [3] }, { rows: [1, 2] })).toEqual({ rows: [3] })
    expect(merge({ when }, { when: { year: 1970 } }).when).toBe(when)
    expect(merge('value', { a: 1 })).toBe('value')
  })

  it('keeps the same objects where nothing changes', () => {
    const current = { grid: { loaded: true }, form: { saved: false } }
    expect(merge({ grid: { loaded: true } }, current)).toBe(current)

    const next = merge({ form: { saved: true } }, current)
    expect(next).not.toBe(current)
    expect(next.grid).toBe(current.grid)
  })

  it('merges into nothing', () => {
    expect(merge({ a: { b: 1 } }, undefined)).toEqual({ a: { b: 1 } })
  })

  it('sets indexes on an array as a copy', () => {
    const current = ['a', 'b']
    const next = merge({ 0: 'x' }, current)
    expect(next).toEqual(['x', 'b'])
    expect(current).toEqual(['a', 'b'])
  })
})

describe('createMergeReducer', () => {
  const reducer = createMergeReducer('grid1', { loaded: false })

  it('starts from the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({ loaded: false })
  })

  it('merges the payload of an action in its namespace', () => {
    expect(reducer({ loaded: false, rows: [] }, { type: 'grid1/ANYTHING', payload: { loaded: true } }))
      .toEqual({ loaded: true, rows: [] })
  })

  it('leaves other namespaces alone, a longer id with the same start included', () => {
    const state = { loaded: false }
    expect(reducer(state, { type: 'grid10/ANYTHING', payload: { loaded: true } })).toBe(state)
    expect(reducer(state, { type: 'grid1', payload: { loaded: true } })).toBe(state)
  })

  it('calls a payload that is a function with the state', () => {
    expect(reducer({ count: 1 }, { type: 'grid1/UPDATE', payload: (state) => ({ count: state.count + 1 }) }))
      .toEqual({ count: 2 })
  })
})
