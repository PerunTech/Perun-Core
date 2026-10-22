import { describe, expect, it } from 'vitest'
import {
  cellCodeListValues, codeListText, decodeCellValue, filterOptions, findCodeListOption, splitCodeListValue
} from '../../../../frontend/elements/grid/logic/codeList'

const STATUS = [{ id: 'ACTIVE', value: 'ACTIVE', text: 'Active' }, { id: 'PASSIVE', value: 'PASSIVE', text: 'Passive' }]
const DISEASES = [
  { id: 1, value: 'BRU', text: 'Brucellosis' },
  { id: 2, value: 'FISH', text: 'Fish - Prototoses, Notions, Helminths' },
  { id: 3, value: 'RAB', title: 'Rabies' }
]

describe('findCodeListOption', () => {
  it('finds an option by its value, id, text or title', () => {
    expect(findCodeListOption(STATUS, 'PASSIVE')).toBe(STATUS[1])
    expect(findCodeListOption(DISEASES, 2)).toBe(DISEASES[1])
    expect(findCodeListOption(STATUS, 'Active')).toBe(STATUS[0])
    expect(findCodeListOption(DISEASES, 'Rabies')).toBe(DISEASES[2])
  })

  it('finds an option that is a plain value', () => {
    expect(findCodeListOption(['CATTLE', 'SHEEP'], 'SHEEP')).toBe('SHEEP')
  })

  it('finds nothing for no value, no options or a value not in the list', () => {
    expect(findCodeListOption(STATUS, null)).toBeUndefined()
    expect(findCodeListOption(STATUS, undefined)).toBeUndefined()
    expect(findCodeListOption([], 'ACTIVE')).toBeUndefined()
    expect(findCodeListOption(undefined, 'ACTIVE')).toBeUndefined()
    expect(findCodeListOption(STATUS, 'CLOSED')).toBeUndefined()
  })
})

describe('splitCodeListValue', () => {
  it('reads an empty cell as no values', () => {
    expect(splitCodeListValue(STATUS, null)).toEqual([])
    expect(splitCodeListValue(STATUS, undefined)).toEqual([])
    expect(splitCodeListValue(STATUS, '')).toEqual([])
  })

  it('splits a comma separated list, trimmed, without empty parts', () => {
    expect(splitCodeListValue(DISEASES, 'BRU, RAB')).toEqual(['BRU', 'RAB'])
    expect(splitCodeListValue(undefined, 'BRU,,RAB, ')).toEqual(['BRU', 'RAB'])
  })

  it('keeps whole a value of the code list that holds commas itself', () => {
    expect(splitCodeListValue(DISEASES, 'Fish - Prototoses, Notions, Helminths')).toEqual(['Fish - Prototoses, Notions, Helminths'])
  })

  it('keeps a value that is not text as it is', () => {
    expect(splitCodeListValue(DISEASES, 2)).toEqual([2])
  })
})

describe('cellCodeListValues', () => {
  it('reads the cell itself when it has no .CODE sibling', () => {
    expect(cellCodeListValues({ DISEASES: 'BRU, RAB' }, 'DISEASES', DISEASES)).toEqual(['BRU', 'RAB'])
  })

  it('reads the codes from a .CODE sibling over the preview text', () => {
    const row = { DISEASES: 'Brucellosis, Rab...', 'DISEASES.CODE': 'BRU,RAB' }
    expect(cellCodeListValues(row, 'DISEASES', DISEASES)).toEqual(['BRU', 'RAB'])
  })

  it('falls back to the cell when the .CODE sibling is empty', () => {
    expect(cellCodeListValues({ DISEASES: 'BRU', 'DISEASES.CODE': '' }, 'DISEASES', DISEASES)).toEqual(['BRU'])
  })
})

describe('codeListText', () => {
  it("shows a code as its option's text, or its value when the option has no text", () => {
    expect(codeListText(STATUS, 'ACTIVE')).toBe('Active')
    expect(codeListText(DISEASES, 3)).toBe('RAB')
  })

  it('shows a value not in the code list as it stands', () => {
    expect(codeListText(STATUS, 'CLOSED')).toBe('CLOSED')
    expect(codeListText(undefined, 'CLOSED')).toBe('CLOSED')
  })
})

describe('decodeCellValue', () => {
  const column = { key: 'DISEASES', formatterOptions: DISEASES }

  it('decodes each code of a cell and joins their texts', () => {
    expect(decodeCellValue(column, { DISEASES: 'BRU' })).toBe('Brucellosis')
    expect(decodeCellValue(column, { DISEASES: 'BRU,FISH' })).toBe('Brucellosis, Fish - Prototoses, Notions, Helminths')
    expect(decodeCellValue(column, { DISEASES: 'RAB' })).toBe('RAB')
  })

  it('decodes the codes of a .CODE sibling', () => {
    expect(decodeCellValue(column, { DISEASES: 'Bruc...', 'DISEASES.CODE': 'BRU,FISH' })).toBe('Brucellosis, Fish - Prototoses, Notions, Helminths')
  })

  it('keeps the cell as it stands when any of its values is not in the code list', () => {
    expect(decodeCellValue(column, { DISEASES: 'BRU, Anthrax' })).toBe('BRU, Anthrax')
    expect(decodeCellValue(column, { DISEASES: '' })).toBe('')
    expect(decodeCellValue(column, {})).toBeUndefined()
  })

  it('keeps the cell of a column without a code list as it stands', () => {
    expect(decodeCellValue({ key: 'NAME' }, { NAME: 'BRU' })).toBe('BRU')
    expect(decodeCellValue({ key: 'NAME', formatterOptions: [] }, { NAME: 'BRU' })).toBe('BRU')
  })
})

describe('filterOptions', () => {
  const columns = [{ key: 'NAME' }, { key: 'STATUS', formatterOptions: STATUS }]
  const rows = [
    { NAME: 'Kumanovo', STATUS: 'ACTIVE' },
    { NAME: 'Bitola', STATUS: 'ACTIVE, PASSIVE' },
    { NAME: 'Ohrid', STATUS: 'Closed' },
    { NAME: 'Struga', STATUS: null }
  ]

  it("offers each value the column's rows hold once, with the text the grid shows", () => {
    expect(filterOptions(columns, rows, 'STATUS')).toEqual([
      { value: 'ACTIVE', label: 'Active' },
      { value: 'PASSIVE', label: 'Passive' },
      { value: 'Closed', label: 'Closed' }
    ])
  })

  it('offers nothing for a column it does not know, or with no columns or rows', () => {
    expect(filterOptions(columns, rows, 'SPECIES')).toEqual([])
    expect(filterOptions([], rows, 'STATUS')).toEqual([])
    expect(filterOptions(columns, [], 'STATUS')).toEqual([])
  })
})
