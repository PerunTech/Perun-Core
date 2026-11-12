// Every <namespace>/ action's payload is merged in; a function payload is called with the state. Plain
// objects merge recursively, anything else replaces, and unchanged state keeps its identity.
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function merge(updates, current) {
  if (!isPlainObject(updates)) return updates
  const base = current ?? {}
  let next = null
  for (const [key, value] of Object.entries(updates)) {
    const merged = isPlainObject(value) ? merge(value, base[key]) : value
    if (merged === base[key]) continue
    next ??= Array.isArray(base) ? [...base] : { ...base }
    next[key] = merged
  }
  return next ?? base
}

export default function createMergeReducer(namespace, initialState) {
  const prefix = `${namespace}/`
  return (state = initialState, action) => {
    if (!action.type.startsWith(prefix)) return state
    return typeof action.payload === 'function' ? action.payload(state) : merge(action.payload, state)
  }
}
