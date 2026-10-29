import { isValidArray } from '../../../model/utils';

/* Code list values reach the grid in more than one shape: as the code itself (`PASSIVE`), as the
text of that code already translated by the backend (`Passive`), and, for fields holding more than
one value, as a comma separated list of either (`Active Clinical, Passive`). Fields of the last
kind sometimes keep their codes in a `<key>.CODE` sibling field and only a preview text in the
field itself. These helpers read all of those, so that the grid, its filters and the exports agree
on what a cell says. */

/* Finds the code list option a single value belongs to, whether it arrives as a code or as the
text of an already translated one. The grid's DropDownFormatter matches an option on its value,
while the rest of this module used to match it on its id - accept either, since the code lists the
backend sends do not always set the two to the same thing. */
export function findCodeListOption(options, value) {
  if (!isValidArray(options, 1) || value === null || value === undefined) {
    return undefined
  }
  return options.find((option) => option === value || option.id === value ||
    option.value === value || option.text === value || option.title === value)
}

/* Splits a cell holding more than one code list value into its parts. A cell that is a value of
the code list in its own right is left whole, since an option's text may hold commas itself
(`Fish - Prototoses, Notions, Helminths`). */
export function splitCodeListValue(options, value) {
  if (value === null || value === undefined || value === '') {
    return []
  }
  if (typeof value !== 'string' || findCodeListOption(options, value)) {
    return [value]
  }
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0)
}

/* Returns the values a single cell holds, read from the `<key>.CODE` sibling field when the
backend sends one, since that field carries the codes themselves rather than a preview text. */
export function cellCodeListValues(row, key, options) {
  const codes = row[`${key}.CODE`]
  const value = (typeof codes === 'string' && codes.length > 0) ? codes : row[key]
  return splitCodeListValue(options, value)
}

/* The text to show for a single code list value: the option's text when the value is a code, and
the value as it stands when it is not in the code list, which is what DropDownFormatter falls back
to on screen (a text the backend already translated included). Reads the option the same way
DropDownFormatter does, so a filter dropdown and an export say what the cells say. */
export function codeListText(options, value) {
  const option = findCodeListOption(options, value)
  if (!option) {
    return value
  }
  return option.text || option.value || value
}

/* Returns the text the grid shows for a single cell: its code list values decoded to their texts,
or, when any of them is not in the code list, the value as it stands - which is what
DropDownFormatter falls back to on screen for a value it cannot decode, a text the backend already
translated included. */
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

/* The values offered in a column's filter dropdown: every value its rows hold, decoded to the
text the grid shows for it. Multi value cells contribute each of their values separately, and a
value the code list does not know is offered as it stands rather than dropped, which is the case
for fields the backend sends already translated. */
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
