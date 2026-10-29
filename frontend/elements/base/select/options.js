/* What the Select reads from its options and its value: the options a value holds, the ones that
match what is typed, and the option its menu shows as moved to. */

export const DELIMITER = ','
const PAGE_SIZE = 5

// Lower case, with the accents of Latin letters taken off (é is e) and other scripts' letters left whole (й is not и).
export function fold(label) {
  return String(label).normalize('NFD').replace(/([A-Za-z])[̀-ͯ]+/g, '$1').normalize('NFC').toLowerCase()
}

// The options whose labels hold every word of the text, less the values in `excluded`.
export function matchOptions(options, foldedLabels, inputValue, excluded) {
  const words = fold(inputValue).split(/\s+/).filter((word) => word.length > 0)
  return options.filter((option, i) => !(excluded && excluded.has(option.value)) &&
    words.every((word) => foldedLabels[i].includes(word)))
}

// The option a plain value names, compared as text, as react-select's expandValue did; an option is itself.
function expandValue(value, options) {
  const type = typeof value
  if (type !== 'string' && type !== 'number' && type !== 'boolean') {
    return value
  }
  return options.find((option) => String(option.value) === String(value))
}

// The options a value holds, as react-select's getValueArray read them.
export function selectedOptions(value, options, multi) {
  if (multi) {
    let values = typeof value === 'string' ? value.split(DELIMITER) : value
    if (!Array.isArray(values)) {
      values = values === null || values === undefined ? [] : [values]
    }
    return values.map((item) => expandValue(item, options)).filter(Boolean)
  }
  const option = expandValue(value, options)
  return option ? [option] : []
}

// The option the menu shows as moved to: `option` when it is in the menu, else the first.
export function focusableIndex(visible, option) {
  if (!visible.length) {
    return null
  }
  if (option) {
    const index = visible.findIndex((candidate) => candidate.value === option.value)
    if (index !== -1) {
      return index
    }
  }
  return 0
}

/* Where a move from the option at `index` lands in a menu of `count` options: the next and the
previous one go round past the ends, a page stops at them. */
export function movedIndex(direction, index, count) {
  const last = count - 1
  switch (direction) {
    case 'next':
      return (index + 1) % count
    case 'previous':
      return index > 0 ? index - 1 : last
    case 'start':
      return 0
    case 'end':
      return last
    case 'page_up':
      return Math.max(index - PAGE_SIZE, 0)
    case 'page_down':
      return Math.min(index + PAGE_SIZE, last)
    default:
      return index
  }
}

// A value as its hidden input holds it.
export function stringifyValue(value) {
  return typeof value === 'string' ? value : (value !== null && JSON.stringify(value)) || ''
}
