// The reducer redux-updeep's createReducer made, in place of redux-updeep and updeep 0.16: every
// action whose type starts with `<namespace>/` has its payload merged into the state. A payload
// that is a function is called with the state instead, and its result taken.
//
// The merge is updeep's for plain data. A plain object merges key by key, recursively, into what
// is there, and anything else (an array, a value, a class instance) replaces it. Where nothing
// changes, the state object stays the same one, so connect and useSelector see no change. Two
// things updeep did are left out, which nothing here relied on: it called a function found inside
// a payload with the current value, where this stores it, and it froze what it returned in the
// development build.
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
