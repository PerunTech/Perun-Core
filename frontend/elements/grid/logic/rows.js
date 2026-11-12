import { cellCodeListValues } from './codeList';

// A filter with a filterValues function decides for itself; one with a text filterTerm keeps the rows
// that contain it, ignoring case.

// Only an empty object means no filters: an array, such as GenericGrid's starting [], still gets a copy.
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

// No direction sorts descending.
function sortRows(rows, sortColumn, sortDirection) {
  if ((!sortDirection && !sortColumn) || sortDirection === 'NONE') {
    return rows
  }
  const sign = sortDirection === 'ASC' ? 1 : -1
  return rows.slice().sort((a, b) => sign * compareValues(a[sortColumn], b[sortColumn]))
}

// A code list filter whose picks were all taken out stays, with an empty list, and keeps every row.
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

export function filtersApplied(filters) {
  return Boolean(filters) && Object.keys(filters).some((key) => filterApplied(filters[key]))
}

// Returns rows itself when nothing filters or sorts them.
export function getRows({ rows = [], filters, sortColumn, sortDirection }) {
  const filtered = hasFilters(filters) ? rows.filter((row) => rowPassesFilters(row, filters)) : rows
  return sortRows(filtered, sortColumn, sortDirection)
}

// Any of a multi-value cell's values matches; they are the values filterOptions offered.
function columnValueContainsSearchTerms(columnValue, filterTerms, cellValues = []) {
  let columnValueContainsSearchTerms = false
  const values = cellValues.map((value) => `${value}`)
  for (const key in filterTerms) {
    if (!Object.prototype.hasOwnProperty.call(filterTerms, key)) {
      continue
    }
    if (columnValue !== undefined && columnValue !== null && filterTerms[key] && filterTerms[key].value !== undefined) {
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

// Kept while it has a filterTerm; a code list column's filter gets a filterValues of its own.
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

// 2024-03-05T10:00:00+01:00 -> 05/03/2024 (shortdate) or 05/03/2024 10:00:00 (longdate), local time.
// Anything else stays as it is.
function formatDate(oldDate, datetype) {
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

// Returns gridData itself when nothing changes.
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

// As the rows have it: its prefix may differ from the config's table name.
export function pkidKey(rows, tableName) {
  return (Array.isArray(rows) && rows.length > 0 && Object.keys(rows[0]).find((key) => key.endsWith('.PKID'))) || `${tableName}.PKID`
}

export function tickRows({ selectedKeys = [], selectedRowData = [] }, ticked, rowKey) {
  return {
    selectedKeys: [...selectedKeys, ...ticked.map(({ row }) => row[rowKey])],
    selectedRowData: [...selectedRowData, ...ticked.map(({ row }) => row)]
  }
}

export function untickRows({ selectedKeys = [], selectedRowData = [] }, unticked, rowKey) {
  const keys = new Set(unticked.map(({ row }) => row[rowKey]))
  return {
    selectedKeys: selectedKeys.filter((key) => !keys.has(key)),
    selectedRowData: selectedRowData.filter((row) => !keys.has(row[rowKey]))
  }
}
