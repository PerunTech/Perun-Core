import { cellCodeListValues } from './codeList';

/* The rows a grid shows: its rows, less the ones its filters leave out, in the order its sort asks
for. This is what react-data-grid-addons' Selectors.getRows did, rule for rule, without the
grouping it also did, which no grid here asks for. Their dates are written as the grid shows them
before that (formatDates).

A filter is kept as the header cell reported it, `{ column, filterTerm, filterValues, ... }`, under
its column's key (withFilter). A filter with a `filterValues` function decides for itself whether a
row stays (withFilter gives every code list filter one). Any other filter with a text `filterTerm`
keeps the rows whose value contains that text, ignoring case. A filter with neither keeps every
row. */

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
 * Whether a filter leaves rows out: it has a text to look for or values picked. A code list filter
 * whose values have all been taken out again stays among the filters with an empty list, and keeps
 * every row.
 * @param {object} filter - A filter as it is kept under its column's key, or undefined.
 * @returns {boolean}
 */
export function filterApplied(filter) {
  if (!filter) {
    return false
  }
  const { filterTerm } = filter
  if (typeof filterTerm === 'string' || Array.isArray(filterTerm)) {
    return filterTerm.length > 0
  }
  return Boolean(filterTerm)
}

/**
 * Whether any of a grid's filters leaves rows out (see filterApplied).
 * @param {object} filters - The filters by column key; GenericGrid starts and clears them as `[]`.
 * @returns {boolean}
 */
export function filtersApplied(filters) {
  return Boolean(filters) && Object.keys(filters).some((key) => filterApplied(filters[key]))
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

/* A row passes a dropdown filter when its cell is the value picked in the filter, or, for a cell
holding more than one value, when the picked value is one of the values that cell lists. The
values of the cell are the same ones filterOptions offered in the dropdown, so a pick always
matches the row it was read from. */
function columnValueContainsSearchTerms(columnValue, filterTerms, cellValues = []) {
  let columnValueContainsSearchTerms = false
  const values = cellValues.map((value) => `${value}`)
  for (const key in filterTerms) {
    if (!Object.prototype.hasOwnProperty.call(filterTerms, key)) {
      continue
    }
    if (columnValue !== undefined && filterTerms[key] && filterTerms[key].value !== undefined) {
      const strColumnValue = columnValue.toString()
      const filterTermValue = filterTerms[key].value.toString()
      if (strColumnValue === filterTermValue || values.includes(filterTermValue)) {
        columnValueContainsSearchTerms = true
        break
      }
    }
  }
  return columnValueContainsSearchTerms
}

/* The `filterValues` of a code list column's filter: whether a row stays. A filter whose picks have
all been taken out again keeps every row. */
function codeListFilterValues(row, columnFilter, columnKey) {
  let include = true
  if (columnFilter === null) {
    include = false
  } else if (!(Array.isArray(columnFilter.filterTerm) && columnFilter.filterTerm.length === 0)) {
    const options = columnFilter.column && columnFilter.column.formatterOptions
    include = columnValueContainsSearchTerms(row[columnKey], columnFilter.filterTerm, cellCodeListValues(row, columnKey, options))
  }
  return include
}

/**
 * A grid's filters with the change a cell of its filter row reported: the filter kept under its
 * column's key while it has a `filterTerm`, and taken out when it has none. A code list column's
 * filter is kept with a `filterValues` of its own.
 * @param {object} filters - The filters by column key; GenericGrid starts and clears them as `[]`.
 * @param {object} filter - `{ column, filterTerm, ... }`, as the cell reported it.
 * @returns {object} New filters; neither argument is changed.
 */
export function withFilter(filters, filter) {
  const newFilters = Object.assign({}, filters)
  if (filter.filterTerm) {
    newFilters[filter.column.key] = filter.column.formatterType === 'DropDownFormatter'
      ? { ...filter, filterValues: codeListFilterValues }
      : filter
  } else {
    delete newFilters[filter.column.key]
  }
  return newFilters
}

/* A date as a date column shows it, when the backend sends a timestamp with an offset
(`2024-03-05T10:00:00+01:00`): `05/03/2024` in a `shortdate` column and `05/03/2024 10:00:00` in a
`longdate` one, in the browser's time zone. Any other value, an invalid date included, as it stands. */
function formatDate(oldDate, datetype) {
  // cast the date string as javascript full date format (object)
  if (oldDate.indexOf('T') > -1 && oldDate.indexOf('+') > -1) {
    const date = new Date(oldDate)
    if (datetype === 'shortdate') {
      let year = date.getFullYear()
      let month = date.getMonth() + 1
      let day = date.getDate()
      if (day < 10) {
        day = '0' + day
      }
      if (month < 10) {
        month = '0' + month
      }
      if (day && month && year) {
        return `${day}/${month}/${year}`
      }
    } else if (datetype === 'longdate') {
      let year = date.getFullYear()
      let month = date.getMonth() + 1
      let day = date.getDate()
      let hours = date.getHours()
      let minutes = date.getMinutes()
      let seconds = date.getSeconds()
      if (day < 10) {
        day = '0' + day
      }
      if (month < 10) {
        month = '0' + month
      }
      if (hours < 10) {
        hours = '0' + hours
      }
      if (minutes < 10) {
        minutes = '0' + minutes
      }
      if (seconds < 10) {
        seconds = '0' + seconds
      }
      if (day && month && year && hours && minutes && seconds) {
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
      }
    }
  }
  return oldDate
}

/**
 * Convert dates from string into javascript short date format: the rows with the values of the
 * columns the config gives a `datetype` written as formatDate writes them. Rows already written so
 * come back as they are.
 * @param {Array} gridConfig - The grid's column config.
 * @param {Array} gridData - The rows, as fetched.
 * @returns {Array} `gridData` itself when no value changes, otherwise a new array in which each row
 *   with a changed value is a copy.
 */
export function formatDates(gridConfig, gridData) {
  let formattedData = gridData
  for (let c = 0; c < gridConfig.length; c++) {
    const { key, datetype } = gridConfig[c]
    if (datetype) {
      for (let d = 0; d < gridData.length; d++) {
        const oldDate = formattedData[d][key]
        if (oldDate) {
          const newDate = formatDate(oldDate, datetype)
          if (newDate !== oldDate) {
            if (formattedData === gridData) {
              formattedData = gridData.slice()
            }
            if (formattedData[d] === gridData[d]) {
              formattedData[d] = { ...gridData[d] }
            }
            formattedData[d][key] = newDate
          }
        }
      }
    }
  }
  return formattedData
}

/**
 * The key that holds each row's PKID, as the rows have it: its prefix may differ from the config's
 * table name.
 * @param {Array} rows - The grid's rows.
 * @param {string} tableName - The config's table name, for a grid with no rows.
 * @returns {string}
 */
export function pkidKey(rows, tableName) {
  return (Array.isArray(rows) && rows.length > 0 && Object.keys(rows[0]).find((key) => key.endsWith('.PKID'))) || `${tableName}.PKID`
}

/**
 * A grid's ticked rows with more ticked.
 * @param {object} selection - `selectedKeys` and `selectedRowData`, as the grid's slice holds them.
 * @param {Array} ticked - The rows ticked, `{ row }` each, as the body reports them.
 * @param {string} rowKey - The key of each row's PKID (see pkidKey).
 * @returns {object} New `selectedKeys` and `selectedRowData`.
 */
export function tickRows({ selectedKeys = [], selectedRowData = [] }, ticked, rowKey) {
  return {
    selectedKeys: [...selectedKeys, ...ticked.map(({ row }) => row[rowKey])],
    selectedRowData: [...selectedRowData, ...ticked.map(({ row }) => row)]
  }
}

/**
 * A grid's ticked rows with some unticked.
 * @param {object} selection - `selectedKeys` and `selectedRowData`, as the grid's slice holds them.
 * @param {Array} unticked - The rows unticked, `{ row }` each, as the body reports them.
 * @param {string} rowKey - The key of each row's PKID (see pkidKey).
 * @returns {object} New `selectedKeys` and `selectedRowData`.
 */
export function untickRows({ selectedKeys = [], selectedRowData = [] }, unticked, rowKey) {
  const keys = new Set(unticked.map(({ row }) => row[rowKey]))
  return {
    selectedKeys: selectedKeys.filter((key) => !keys.has(key)),
    selectedRowData: selectedRowData.filter((row) => !keys.has(row[rowKey]))
  }
}
