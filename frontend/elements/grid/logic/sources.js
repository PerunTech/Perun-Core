const isPlainObject = (value) => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

// Arrays and plain objects by content, anything else by identity: callers build their params anew on
// each render, which is no reason to fetch again.
export function sameValue(a, b) {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((item, i) => sameValue(item, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key]))
  }
  return false
}

// A caller's own path without a % can't use params. BASE and CUSTOM read a verb's path, which may.
const paramsFor = (gridType, path, params) =>
  gridType !== 'BASE' && gridType !== 'CUSTOM' && typeof path === 'string' && !path.includes('%') ? undefined : params

export const sourcesOf = ({ gridType, configTableName, dataTableName, params, session }) => ({
  config: [gridType, configTableName, paramsFor(gridType, configTableName, params)],
  data: [gridType, dataTableName, paramsFor(gridType, dataTableName, params)],
  session
})

// A logout clears the session before the grid's screen unmounts, so nothing is fetched without one.
export function changedSources(before, now) {
  if (!before || (before.session && !now.session)) {
    return { config: false, data: false }
  }
  return { config: !sameValue(before.config, now.config), data: !sameValue(before.data, now.data) }
}
