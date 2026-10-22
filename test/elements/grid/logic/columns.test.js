import { describe, expect, it, vi } from 'vitest'
import { columnType, defaultSort, gridColumns } from '../../../../frontend/elements/grid/logic/columns'

const config = [
  { key: 'NAME', name: 'NAME', editable: true },
  { key: 'STATUS', name: 'STATUS', formatterType: 'DropDownFormatter' }
]
const printColumn = { key: 'print', name: 'print' }

describe('gridColumns', () => {
  it('gives each column the parts its config names, in new objects', () => {
    const parts = vi.fn((column) => (column.formatterType ? { formatter: 'DropDownFormatter' } : {}))
    const columns = gridColumns(config, { parts })
    expect(columns).toEqual([config[0], { ...config[1], formatter: 'DropDownFormatter' }])
    expect(columns[0]).not.toBe(config[0])
    expect(config[1].formatter).toBeUndefined()
    expect(parts).toHaveBeenCalledWith(config[0])
  })

  it('puts the print column first, once', () => {
    const parts = () => ({})
    expect(gridColumns(config, { parts, printColumn }).map((column) => column.key)).toEqual(['print', 'NAME', 'STATUS'])
    const withPrint = [...config, printColumn]
    expect(gridColumns(withPrint, { parts, printColumn }).map((column) => column.key)).toEqual(['NAME', 'STATUS', 'print'])
  })

  it('names every column, the print column included, by translate', () => {
    const columns = gridColumns(config, { parts: () => ({}), printColumn, translate: (key) => `label.${key}` })
    expect(columns.map((column) => column.name)).toEqual(['label.print', 'label.NAME', 'label.STATUS'])
    expect(printColumn.name).toBe('print')
  })
})

describe('defaultSort', () => {
  it('is undefined when no column is marked', () => {
    expect(defaultSort(config)).toBeUndefined()
  })

  it("sorts by the marked column, in its direction or descending", () => {
    expect(defaultSort([{ key: 'NAME', isDefaultSort: true }])).toEqual({ sortColumn: 'NAME', sortDirection: 'DESC' })
    expect(defaultSort([{ key: 'NAME', isDefaultSort: true, defaultSortDirection: 'ASC' }])).toEqual({ sortColumn: 'NAME', sortDirection: 'ASC' })
  })

  it('takes the last column when several are marked', () => {
    expect(defaultSort([{ key: 'NAME', isDefaultSort: true }, { key: 'ANIMALS' }, { key: 'STATUS', isDefaultSort: true }]).sortColumn).toBe('STATUS')
  })
})

describe('columnType', () => {
  const rows = [{ ANIMALS: 12, CODE: '0012', STATUS: 1, AREA: 4.5 }, { ANIMALS: null, CODE: '0040', AREA: 'n/a' }, { ANIMALS: '', STATUS: 2 }, { ANIMALS: 0 }]

  it('is code for a code list column and date for a dated one', () => {
    expect(columnType({ key: 'STATUS', formatterType: 'DropDownFormatter' }, rows)).toBe('code')
    expect(columnType({ key: 'ANIMALS', datetype: 'shortdate' }, rows)).toBe('date')
  })

  it('is number when every filled cell is a number', () => {
    expect(columnType({ key: 'ANIMALS' }, rows)).toBe('number')
    expect(columnType({ key: 'STATUS' }, rows)).toBe('number')
  })

  it('is undefined for text, digits in text, numbers mixed with text, empty columns and no column', () => {
    expect(columnType({ key: 'AREA' }, rows)).toBeUndefined()
    expect(columnType({ key: 'CODE' }, rows)).toBeUndefined()
    expect(columnType({ key: 'NAME' }, rows)).toBeUndefined()
    expect(columnType({ key: 'ANIMALS' }, [])).toBeUndefined()
    expect(columnType(undefined, rows)).toBeUndefined()
  })
})
