import { combineReducers, legacy_createStore as createStore } from 'redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { autoRehydrate, persistStore } from '../../frontend/model/persist'

const fakeStorage = (entries = {}) => {
  const items = new Map(Object.entries(entries))
  return {
    getItem: vi.fn((key) => (items.has(key) ? items.get(key) : null)),
    setItem: vi.fn((key, value) => { items.set(key, String(value)) }),
    clear: () => items.clear()
  }
}

const initial = { security: { svSession: null, user: null }, intl: { locale: 'en_US' }, menu: { open: false } }

const slices = {
  security: (state = initial.security, action) => (action.type === 'login' ? { ...state, svSession: action.svSession } : state),
  intl: (state = initial.intl) => state,
  menu: (state = initial.menu, action) => (action.type === 'toggle' ? { open: !state.open } : state)
}

const makeStore = () => createStore(combineReducers(slices), autoRehydrate())

describe('persistStore', () => {
  let storage

  beforeEach(() => {
    vi.useFakeTimers()
    storage = fakeStorage({
      'reduxPersist:security': JSON.stringify({ svSession: 'abc' }),
      'reduxPersist:intl': JSON.stringify({ locale: 'mk_MK' }),
      'reduxPersist:menu': JSON.stringify({ open: true })
    })
    vi.stubGlobal('window', { localStorage: storage })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('restores the whitelisted slices on a later task, keeping keys added since they were saved', () => {
    const store = makeStore()
    const done = vi.fn()

    persistStore(store, { whitelist: ['security', 'intl'] }, done)
    expect(done).not.toHaveBeenCalled()
    vi.runAllTimers()

    expect(done).toHaveBeenCalledOnce()
    expect(store.getState()).toEqual({
      security: { svSession: 'abc', user: null },
      intl: { locale: 'mk_MK' },
      menu: { open: false }
    })
  })

  it('leaves a slice saved as null over an object, and ignores slices the state does not have', () => {
    storage.setItem('reduxPersist:security', 'null')
    storage.setItem('reduxPersist:gone', JSON.stringify({ a: 1 }))
    const store = makeStore()

    persistStore(store, { whitelist: ['security', 'gone'] })
    vi.runAllTimers()

    expect(store.getState().security).toEqual(initial.security)
    expect(store.getState()).not.toHaveProperty('gone')
  })

  it('skips a slice that does not parse and restores the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    storage.setItem('reduxPersist:security', '{not json')
    const store = makeStore()

    persistStore(store, { whitelist: ['security', 'intl'] })
    vi.runAllTimers()

    expect(store.getState().security).toEqual(initial.security)
    expect(store.getState().intl).toEqual({ locale: 'mk_MK' })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('writes a changed slice back once per task, and only the whitelisted ones', () => {
    const store = makeStore()
    persistStore(store, { whitelist: ['security'] })
    vi.runAllTimers()
    storage.setItem.mockClear()

    store.dispatch({ type: 'login', svSession: 'one' })
    store.dispatch({ type: 'login', svSession: 'two' })
    store.dispatch({ type: 'toggle' })
    expect(storage.setItem).not.toHaveBeenCalled()
    vi.runAllTimers()

    expect(storage.setItem).toHaveBeenCalledOnce()
    expect(JSON.parse(storage.getItem('reduxPersist:security'))).toEqual({ svSession: 'two', user: null })
  })

  it('restores a slice a longer whitelist adds before it writes that slice', () => {
    const store = makeStore()
    persistStore(store, { whitelist: ['security'] })
    vi.runAllTimers()

    store.dispatch({ type: 'toggle' })
    persistStore(store, { whitelist: ['security', 'intl'] })
    vi.runAllTimers()

    expect(store.getState().intl).toEqual({ locale: 'mk_MK' })
    expect(JSON.parse(storage.getItem('reduxPersist:intl'))).toEqual({ locale: 'mk_MK' })
  })

  it('puts back a slice the login page cleared, changed or not', () => {
    const store = makeStore()
    persistStore(store, { whitelist: ['security', 'intl'] })
    vi.runAllTimers()

    storage.clear()
    store.dispatch({ type: 'toggle' })
    vi.runAllTimers()

    expect(JSON.parse(storage.getItem('reduxPersist:security'))).toEqual({ svSession: 'abc', user: null })
    expect(JSON.parse(storage.getItem('reduxPersist:intl'))).toEqual({ locale: 'mk_MK' })
  })

  it('keeps rehydrating through replaceReducer, as injectAsyncReducer uses it', () => {
    const store = makeStore()
    store.replaceReducer(combineReducers({ ...slices, grid: (state = { rows: [] }) => state }))

    persistStore(store, { whitelist: ['intl'] })
    vi.runAllTimers()

    expect(store.getState().intl).toEqual({ locale: 'mk_MK' })
    expect(store.getState().grid).toEqual({ rows: [] })
  })

  it('still completes where the browser blocks storage', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('SecurityError') } })
    const store = makeStore()
    const done = vi.fn()

    persistStore(store, { whitelist: ['security'] }, done)
    vi.runAllTimers()
    store.dispatch({ type: 'login', svSession: 'x' })
    vi.runAllTimers()

    expect(done).toHaveBeenCalledOnce()
    expect(store.getState().security.svSession).toBe('x')
  })
})
