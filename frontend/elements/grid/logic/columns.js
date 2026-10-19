/* A grid's columns as it draws them, made from the column config its slice holds, and what the
config and the rows tell about them. */

/**
 * The columns a grid draws, made from its column config as new objects, the config left as it is.
 * Each column gets the editor, formatter and filter its config names, the print column goes first
 * when there is one and the config does not have it yet, and every column, the print column
 * included, takes its name from `translate` when there is one.
 * @param {Array} config - The column config.
 * @param {object} options - `parts`, `(column)` to the `editor`, `formatter` and `filterRenderer`
 *   its config names (see cells/columnParts.js); `printColumn`, or undefined for a grid without a
 *   printout; `translate`, `(key)` to a column's name, or undefined to keep the config's names.
 * @returns {Array}
 */
export function gridColumns(config, { parts, printColumn, translate }) {
  const columns = config.map((column) => ({ ...column, ...parts(column) }))
  if (printColumn && !columns.some((column) => column.key === printColumn.key)) {
    columns.unshift(printColumn)
  }
  return translate ? columns.map((column) => ({ ...column, name: translate(column.key) })) : columns
}

/**
 * The sort a grid starts with: the column its config marks `isDefaultSort`, the last one when it
 * marks more than one, in its `defaultSortDirection`, or else descending.
 * @param {Array} config - The column config.
 * @returns {object} `{ sortColumn, sortDirection }`, or undefined when no column is marked.
 */
export function defaultSort(config) {
  const column = config.filter((candidate) => candidate.isDefaultSort).pop()
  return column && { sortColumn: column.key, sortDirection: column.defaultSortDirection ? column.defaultSortDirection : 'DESC' }
}

/* What a column holds, for the deployment's sheet to align and colour its cells by: `code` for a
code list column, `date` for a column the config gives a `datetype`, `number` for a column whose
every filled cell in the rows is a number, and undefined for anything else. The grid metadata does
not say which fields are numbers, so the rows do. */
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
