// redux-persist 4's format: each slice as JSON under reduxPersist:<slice> (lpis reads
// reduxPersist:security itself), restored through persist/REHYDRATE.
const KEY_PREFIX = 'reduxPersist:'
const REHYDRATE = 'persist/REHYDRATE'

// Reading `window.localStorage` throws where the browser blocks storage for the page.
function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// A slice the reducer changed on this action stays as it made it. A plain object is merged in, so keys
// added since it was saved keep their initial values.
function rehydrating(reducer) {
  return (state, action) => {
    const reduced = reducer(state, action)
    if (action.type !== REHYDRATE || !state) return reduced
    const merged = { ...reduced }
    for (const [key, saved] of Object.entries(action.payload)) {
      if (!Object.prototype.hasOwnProperty.call(state, key)) continue
      if (typeof state[key] === 'object' && !saved) continue
      if (state[key] !== reduced[key]) continue
      merged[key] = isPlainObject(saved) && isPlainObject(state[key]) ? { ...state[key], ...saved } : saved
    }
    return merged
  }
}

// Applied to every reducer the store gets, injectAsyncReducer's included.
export function autoRehydrate() {
  return (next) => (reducer, preloadedState) => {
    const store = next(rehydrating(reducer), preloadedState)
    return { ...store, replaceReducer: (nextReducer) => store.replaceReducer(rehydrating(nextReducer)) }
  }
}

// Per store: the slices being written back, and the value of each when it was last looked at.
const writers = new WeakMap()

// Once per task, off the dispatch. A slice missing from storage is written even unchanged, since the
// login page clears localStorage when it mounts.
function writerFor(store) {
  let writer = writers.get(store)
  if (writer) return writer
  const kept = new Set()
  const seen = {}
  let scheduled = false
  const write = () => {
    scheduled = false
    const state = store.getState()
    for (const key of kept) {
      try {
        if (state[key] === seen[key] && storage()?.getItem(KEY_PREFIX + key) !== null) continue
        seen[key] = state[key]
        if (state[key] === undefined) continue
        storage()?.setItem(KEY_PREFIX + key, JSON.stringify(state[key]))
      } catch (err) {
        console.warn(`Could not save ${key} to localStorage`, err)
      }
    }
  }
  store.subscribe(() => {
    if (!scheduled) {
      scheduled = true
      setTimeout(write)
    }
  })
  writer = { keep: (key) => kept.add(key) }
  writers.set(store, writer)
  return writer
}

// A slice is written only after its first restore: until then the store holds its initial value,
// which would overwrite the saved one.
export function persistStore(store, { whitelist = [] } = {}, onComplete) {
  const writer = writerFor(store)
  setTimeout(() => {
    const saved = {}
    for (const key of whitelist) {
      let serialized = null
      try {
        serialized = storage()?.getItem(KEY_PREFIX + key) ?? null
        if (serialized !== null) saved[key] = JSON.parse(serialized)
      } catch (err) {
        console.warn(`Could not restore ${key} from localStorage`, err)
      }
    }
    try {
      store.dispatch({ type: REHYDRATE, payload: saved })
    } finally {
      whitelist.forEach(writer.keep)
      onComplete?.()
    }
  })
}
