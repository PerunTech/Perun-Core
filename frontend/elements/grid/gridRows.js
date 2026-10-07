/* The rows a grid shows: its rows, less the ones its filters leave out, in the order its sort asks
for. This is what react-data-grid-addons' Selectors.getRows did, rule for rule, without the
grouping it also did, which no grid here asks for.

A filter is kept as the header cell reported it, `{ column, filterTerm, filterValues, ... }`, under
its column's key. A filter with a `filterValues` function decides for itself whether a row stays
(GenericGrid gives every dropdown filter one). Any other filter with a text `filterTerm` keeps the
rows whose value contains that text, ignoring case. A filter with neither keeps every row. */

/* Only an object with no keys means "no filters". An array does not count, even an empty one:
GenericGrid starts its filters as `[]`, and the addons' test also asked for a plain object, so an
array is run through the filter and the grid gets a copy of its rows. */
function hasFilters(filters) {
  return Boolean(filters) && !(Object.keys(filters).length === 0 && filters.constructor === Object)
}

function rowPassesFilters(row, filters) {
  let include = true
  for (const columnKey in filters) {
    if (!Object.prototype.hasOwnProperty.call(filters, columnKey)) {
      continue
    }
    const columnFilter = filters[columnKey]
    if (typeof columnFilter.filterValues === 'function') {
      include = include && Boolean(columnFilter.filterValues(row, columnFilter, columnKey))
    } else if (typeof columnFilter.filterTerm === 'string') {
      const value = row[columnKey]
      include = include && value !== undefined && value !== null &&
        value.toString().toLowerCase().includes(columnFilter.filterTerm.toLowerCase())
    }
  }
  return include
}

function compareValues(a, b) {
  if (a > b) {
    return 1
  }
  if (a < b) {
    return -1
  }
  return 0
}

/* A sort column without a direction sorts descending, as the addons did. */
function sortRows(rows, sortColumn, sortDirection) {
  if ((!sortDirection && !sortColumn) || sortDirection === 'NONE') {
    return rows
  }
  const sign = sortDirection === 'ASC' ? 1 : -1
  return rows.slice().sort((a, b) => sign * compareValues(a[sortColumn], b[sortColumn]))
}

/**
 * The rows to show for a grid's state, recomputed on every call.
 * @param {object} state - `rows`, `filters`, and optionally `sortColumn` and `sortDirection`.
 * @returns {Array} `state.rows` itself when nothing filters or sorts them, otherwise a new array.
 */
export function getRows({ rows = [], filters, sortColumn, sortDirection }) {
  const filtered = hasFilters(filters) ? rows.filter((row) => rowPassesFilters(row, filters)) : rows
  return sortRows(filtered, sortColumn, sortDirection)
}

/**
 * A `getRows` for one grid, which hands back the same array while the grid's rows, filters and
 * sort are the same ones as on the last call.
 *
 * The grid asks for its rows once per row it draws, so working them out again on every call would
 * filter and sort the whole table for each visible row. It also keeps the array stable for code
 * that writes into it: GenericGrid puts a saved row back by index into the array this returns, and
 * draws from that same array afterwards. The addons kept one such cache for every grid on the page
 * together; this one belongs to a single grid, so another grid cannot evict it.
 * @returns {function(object): Array}
 */
export function createRowsSelector() {
  let last
  return (state) => {
    const { rows, filters, sortColumn, sortDirection } = state
    if (!last || last.rows !== rows || last.filters !== filters ||
      last.sortColumn !== sortColumn || last.sortDirection !== sortDirection) {
      last = { rows, filters, sortColumn, sortDirection, result: getRows(state) }
    }
    return last.result
  }
}
