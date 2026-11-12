import { isValidArray } from '../../../model/utils';

// Values arrive as codes, as text the backend translated, or as comma separated lists of either (the
// codes sometimes in a <key>.CODE sibling). These read all of them, so grid, filters and exports agree.

// By value or id: the backend's code lists don't always set the two the same.
export function findCodeListOption(options, value) {
  if (!isValidArray(options, 1) || value === null || value === undefined) {
    return undefined
  }
  return options.find((option) => option === value || option.id === value ||
    option.value === value || option.text === value || option.title === value)
}

// A cell that is itself an option is left whole, since an option's text may hold commas.
export function splitCodeListValue(options, value) {
  if (value === null || value === undefined || value === '') {
    return []
  }
  if (typeof value !== 'string' || findCodeListOption(options, value)) {
    return [value]
  }
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0)
}

// The <key>.CODE sibling carries the codes rather than a preview text.
export function cellCodeListValues(row, key, options) {
  const codes = row[`${key}.CODE`]
  const value = (typeof codes === 'string' && codes.length > 0) ? codes : row[key]
  return splitCodeListValue(options, value)
}

// Read as DropDownFormatter reads it, so a filter dropdown and an export say what the cells say.
export function codeListText(options, value) {
  const option = findCodeListOption(options, value)
  if (!option) {
    return value
  }
  return option.text || option.value || value
}

// A value not in the code list leaves the cell as it stands, as DropDownFormatter shows it.
export function decodeCellValue(config, element) {
  const value = element[config.key]
  const options = config.formatterOptions
  if (!isValidArray(options, 1)) {
    return value
  }
  const decoded = cellCodeListValues(element, config.key, options)
    .map((cellValue) => findCodeListOption(options, cellValue))
  if (decoded.length > 0 && decoded.every((option) => option !== undefined)) {
    return decoded.map((option) => option.text || option.value).join(', ')
  }
  return value
}

// A value the code list doesn't know is offered as it stands: some fields arrive translated.
export function filterOptions(columns, rows, columnId) {
  if (!isValidArray(columns, 1) || !isValidArray(rows, 1)) {
    return []
  }
  const config = columns.find((column) => column.key === columnId)
  if (!config) {
    return []
  }
  const options = config.formatterOptions
  const values = new Map()
  rows.forEach((row) => {
    cellCodeListValues(row, columnId, options).forEach((value) => {
      if (!values.has(value)) {
        values.set(value, { value, label: codeListText(options, value) })
      }
    })
  })
  return Array.from(values.values())
}
