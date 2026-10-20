/* Where a grid's config and rows come from: what GenericGrid fetches them with, and fetches them
again with when it changes. */

const isPlainObject = (value) => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

/* Whether two values hold the same things: arrays and plain objects by what they hold, anything
else (a path, a function, a class instance) by identity. Callers build their params anew on each
render, and some their SEARCH_GRID_DATA columns and rows as well, so a new array that holds the
same values is no reason to fetch again. */
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

/* The params that count for a path: none for a path of the caller's own with no % in it, which they
cannot change. BASE and CUSTOM read the path of a verb in svConfig, which may use them, and the
rows of SEARCH_GRID_DATA may be no path at all. */
const paramsFor = (gridType, path, params) =>
  gridType !== 'BASE' && gridType !== 'CUSTOM' && typeof path === 'string' && !path.includes('%') ? undefined : params

/* A grid's sources, as its props give them: its config's and its rows'. */
export const sourcesOf = ({ gridType, configTableName, dataTableName, params }) => ({
  config: [gridType, configTableName, paramsFor(gridType, configTableName, params)],
  data: [gridType, dataTableName, paramsFor(gridType, dataTableName, params)]
})
