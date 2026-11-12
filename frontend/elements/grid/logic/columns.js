// New objects, the config left as it is. The print column goes first when the config lacks it.
export function gridColumns(config, { parts, printColumn, translate }) {
  const columns = config.map((column) => ({ ...column, ...parts(column) }))
  if (printColumn && !columns.some((column) => column.key === printColumn.key)) {
    columns.unshift(printColumn)
  }
  return translate ? columns.map((column) => ({ ...column, name: translate(column.key) })) : columns
}

// The last column marked isDefaultSort, in its defaultSortDirection, else descending.
export function defaultSort(config) {
  const column = config.filter((candidate) => candidate.isDefaultSort).pop()
  return column && { sortColumn: column.key, sortDirection: column.defaultSortDirection ? column.defaultSortDirection : 'DESC' }
}

// For the deployment's sheet to align and colour by. The metadata doesn't say which fields are numbers,
// so the rows do.
export function columnType(column, rows) {
  if (!column) {
    return undefined
  }
  if (column.formatterType === 'DropDownFormatter') {
    return 'code'
  }
  if (column.datetype) {
    return 'date'
  }
  let numbers = 0
  for (const row of rows) {
    const value = row[column.key]
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value !== 'number') {
        return undefined
      }
      numbers += 1
    }
  }
  return numbers > 0 ? 'number' : undefined
}
