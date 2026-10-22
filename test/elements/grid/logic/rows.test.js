import { describe, expect, it, vi } from 'vitest'
import {
  filterApplied, filtersApplied, formatDates, getRows, pkidKey, tickRows, untickRows, withFilter
} from '../../../../frontend/elements/grid/logic/rows'

// formatDates writes dates in the local time zone. Etc/GMT-1 is UTC+1 all year (the sign is POSIX's).
process.env.TZ = 'Etc/GMT-1'

const holdings = [
  { 'HOLDING.PKID': 1, NAME: 'Kumanovo farm', ANIMALS: 12 },
  { 'HOLDING.PKID': 2, NAME: 'Bitola dairy', ANIMALS: 40 },
  { 'HOLDING.PKID': 3, NAME: 'Ohrid FARM', ANIMALS: 7 }
]

const pkids = (rows) => rows.map((row) => row['HOLDING.PKID'])
const textFilter = (key, filterTerm) => ({ column: { key, name: key }, filterTerm })

const STATUS = {
  key: 'STATUS',
  name: 'Status',
  formatterType: 'DropDownFormatter',
  formatterOptions: [{ id: 'ACTIVE', value: 'ACTIVE', text: 'Active' }, { id: 'PASSIVE', value: 'PASSIVE', text: 'Passive' }]
}
const SPECIES = {
  key: 'SPECIES',
  name: 'Species',
  formatterType: 'DropDownFormatter',
  formatterOptions: [{ value: 'CATTLE', text: 'Cattle' }, { value: 'SHEEP', text: 'Sheep' }, { value: 'GOAT', text: 'Goat' }]
}
const pick = (...values) => values.map((value) => ({ value, label: value }))

describe('getRows', () => {
  it('returns the rows themselves when nothing filters or sorts them', () => {
    expect(getRows({ rows: holdings })).toBe(holdings)
    expect(getRows({ rows: holdings, filters: {} })).toBe(holdings)
    expect(getRows({ filters: {} })).toEqual([])
  })

  it('runs an array of filters, even an empty one, and returns a copy', () => {
    const rows = getRows({ rows: holdings, filters: [] })
    expect(rows).toEqual(holdings)
    expect(rows).not.toBe(holdings)
  })

  it('keeps the rows whose value contains the text, in any case', () => {
    expect(pkids(getRows({ rows: holdings, filters: { NAME: textFilter('NAME', 'fArM') } }))).toEqual([1, 3])
  })

  it('reads a number as its digits', () => {
    expect(pkids(getRows({ rows: holdings, filters: { ANIMALS: textFilter('ANIMALS', '4') } }))).toEqual([2])
  })

  it('leaves out a row with no value under a text filter', () => {
    const rows = [...holdings, { 'HOLDING.PKID': 4, NAME: null }, { 'HOLDING.PKID': 5 }]
    expect(pkids(getRows({ rows, filters: { NAME: textFilter('NAME', 'a') } }))).toEqual([1, 2, 3])
  })

  it('keeps only the rows every filter keeps', () => {
    const filters = { NAME: textFilter('NAME', 'farm'), ANIMALS: textFilter('ANIMALS', '7') }
    expect(pkids(getRows({ rows: holdings, filters }))).toEqual([3])
  })

  it('lets a filter with filterValues decide for itself', () => {
    const filterValues = vi.fn((row) => row.ANIMALS > 10)
    const filter = { column: { key: 'ANIMALS' }, filterTerm: 'ignored', filterValues }
    expect(pkids(getRows({ rows: holdings, filters: { ANIMALS: filter } }))).toEqual([1, 2])
    expect(filterValues).toHaveBeenCalledWith(holdings[0], filter, 'ANIMALS')
  })

  it('keeps every row under a filter with neither a text nor filterValues', () => {
    expect(getRows({ rows: holdings, filters: { NAME: { column: { key: 'NAME' }, filterTerm: [] } } })).toEqual(holdings)
  })

  it('sorts a copy, ascending or descending', () => {
    const order = pkids(holdings)
    expect(pkids(getRows({ rows: holdings, sortColumn: 'ANIMALS', sortDirection: 'ASC' }))).toEqual([3, 1, 2])
    expect(pkids(getRows({ rows: holdings, sortColumn: 'NAME', sortDirection: 'DESC' }))).toEqual([3, 1, 2])
    expect(pkids(getRows({ rows: holdings, sortColumn: 'NAME', sortDirection: 'ASC' }))).toEqual([2, 1, 3])
    expect(pkids(holdings)).toEqual(order)
  })

  it('sorts descending when the sort column has no direction', () => {
    expect(pkids(getRows({ rows: holdings, sortColumn: 'ANIMALS' }))).toEqual([2, 1, 3])
  })

  it('leaves the order alone for NONE', () => {
    expect(getRows({ rows: holdings, sortColumn: 'ANIMALS', sortDirection: 'NONE' })).toBe(holdings)
  })

  it('filters before it sorts', () => {
    const rows = getRows({ rows: holdings, filters: { NAME: textFilter('NAME', 'farm') }, sortColumn: 'ANIMALS', sortDirection: 'ASC' })
    expect(pkids(rows)).toEqual([3, 1])
  })
})

describe('filterApplied', () => {
  it('is true for a text or for values picked', () => {
    expect(filterApplied({ filterTerm: 'farm' })).toBe(true)
    expect(filterApplied({ filterTerm: pick('ACTIVE') })).toBe(true)
  })

  it('is false for no filter, an empty text or every pick taken out again', () => {
    expect(filterApplied(undefined)).toBe(false)
    expect(filterApplied({ filterTerm: '' })).toBe(false)
    expect(filterApplied({ filterTerm: [] })).toBe(false)
    expect(filterApplied({})).toBe(false)
  })
})

describe('filtersApplied', () => {
  it('is false for the filters a grid starts with', () => {
    expect(filtersApplied([])).toBe(false)
    expect(filtersApplied(undefined)).toBe(false)
    expect(filtersApplied({})).toBe(false)
  })

  it('is true when any filter leaves rows out', () => {
    expect(filtersApplied({ STATUS: { filterTerm: [] } })).toBe(false)
    expect(filtersApplied({ STATUS: { filterTerm: [] }, NAME: { filterTerm: 'farm' } })).toBe(true)
  })
})

describe('withFilter', () => {
  it("keeps a text filter under its column's key, as reported", () => {
    const filter = textFilter('NAME', 'farm')
    const filters = withFilter([], filter)
    expect(filters).toEqual({ NAME: filter })
    expect(filters.NAME).toBe(filter)
  })

  it('takes a filter out when its text is emptied, and changes neither argument', () => {
    const before = { NAME: textFilter('NAME', 'farm'), ANIMALS: textFilter('ANIMALS', '7') }
    const filter = textFilter('NAME', '')
    expect(withFilter(before, filter)).toEqual({ ANIMALS: before.ANIMALS })
    expect(Object.keys(before)).toEqual(['NAME', 'ANIMALS'])
    expect(filter).toEqual(textFilter('NAME', ''))
  })

  it('gives a code list filter a filterValues of its own', () => {
    const filter = { column: STATUS, filterTerm: pick('ACTIVE') }
    const filters = withFilter([], filter)
    expect(filters.STATUS).toMatchObject(filter)
    expect(typeof filters.STATUS.filterValues).toBe('function')
    expect(filter.filterValues).toBeUndefined()
  })
})

describe('a code list filter', () => {
  const herds = [
    { 'HOLDING.PKID': 1, STATUS: 'ACTIVE', SPECIES: 'CATTLE' },
    { 'HOLDING.PKID': 2, STATUS: 'PASSIVE', SPECIES: 'CATTLE, SHEEP' },
    { 'HOLDING.PKID': 3, STATUS: 'ACTIVE', SPECIES: 'Cattle and sheep', 'SPECIES.CODE': 'GOAT,SHEEP' },
    { 'HOLDING.PKID': 4, STATUS: 'PASSIVE', SPECIES: 'GOAT' }
  ]
  const filtered = (column, filterTerm) => pkids(getRows({ rows: herds, filters: withFilter([], { column, filterTerm }) }))

  it('keeps the rows holding any value picked', () => {
    expect(filtered(STATUS, pick('ACTIVE'))).toEqual([1, 3])
    expect(filtered(STATUS, pick('ACTIVE', 'PASSIVE'))).toEqual([1, 2, 3, 4])
  })

  it('finds a pick among the values of a cell holding more than one', () => {
    expect(filtered(SPECIES, pick('SHEEP'))).toEqual([2, 3])
  })

  it('reads the codes of a cell from its .CODE sibling', () => {
    expect(filtered(SPECIES, pick('GOAT'))).toEqual([3, 4])
  })

  it('keeps every row once every pick is taken out again', () => {
    expect(filtered(STATUS, [])).toEqual([1, 2, 3, 4])
  })

  it('leaves out a row with no value', () => {
    const rows = [...herds, { 'HOLDING.PKID': 5, STATUS: null }, { 'HOLDING.PKID': 6 }]
    expect(pkids(getRows({ rows, filters: withFilter([], { column: STATUS, filterTerm: pick('ACTIVE') }) }))).toEqual([1, 3])
  })
})

describe('formatDates', () => {
  const config = [
    { key: 'DATE_OF_BIRTH', datetype: 'shortdate' },
    { key: 'REGISTERED', datetype: 'longdate' },
    { key: 'NAME' }
  ]

  it('writes a timestamp as its column shows it, in the local time zone', () => {
    const rows = [{ NAME: 'Bitola dairy', DATE_OF_BIRTH: '2024-03-05T23:30:00+00:00', REGISTERED: '2024-01-02T03:04:05+01:00' }]
    expect(formatDates(config, rows)).toEqual([
      { NAME: 'Bitola dairy', DATE_OF_BIRTH: '06/03/2024', REGISTERED: '02/01/2024 03:04:05' }
    ])
  })

  it('copies the rows it changes and keeps the others, the input left as it is', () => {
    const changed = { NAME: 'Ohrid', DATE_OF_BIRTH: '2023-11-20T10:00:00+01:00' }
    const unchanged = { NAME: 'Kumanovo', DATE_OF_BIRTH: null }
    const rows = [changed, unchanged]
    const formatted = formatDates(config, rows)
    expect(formatted).not.toBe(rows)
    expect(formatted[0]).not.toBe(changed)
    expect(formatted[1]).toBe(unchanged)
    expect(changed.DATE_OF_BIRTH).toBe('2023-11-20T10:00:00+01:00')
    expect(rows[0]).toBe(changed)
  })

  it('returns the rows themselves when nothing changes', () => {
    const rows = [{ DATE_OF_BIRTH: '20/11/2023', REGISTERED: '' }]
    expect(formatDates(config, rows)).toBe(rows)
    expect(formatDates([{ key: 'NAME' }], [{ NAME: '2024-03-05T10:00:00+01:00' }])[0].NAME).toBe('2024-03-05T10:00:00+01:00')
  })

  it('leaves a value with no offset, no time or no valid date as it stands', () => {
    const rows = [
      { DATE_OF_BIRTH: '2024-03-05T10:00:00Z' },
      { DATE_OF_BIRTH: '2024-03-05' },
      { DATE_OF_BIRTH: 'unknownT+' }
    ]
    expect(formatDates(config, rows)).toBe(rows)
  })

  it('formats rows already formatted to the same result', () => {
    const once = formatDates(config, [{ DATE_OF_BIRTH: '2024-03-05T10:00:00+01:00' }])
    expect(formatDates(config, once)).toBe(once)
  })
})

describe('pkidKey', () => {
  it('reads the key from the rows, whatever its prefix', () => {
    expect(pkidKey(holdings, 'SVAROG_HOLDING')).toBe('HOLDING.PKID')
  })

  it("falls back to the config's table name", () => {
    expect(pkidKey([], 'HOLDING')).toBe('HOLDING.PKID')
    expect(pkidKey(undefined, 'HOLDING')).toBe('HOLDING.PKID')
    expect(pkidKey([{ NAME: 'Ohrid' }], 'HOLDING')).toBe('HOLDING.PKID')
  })
})

describe('tickRows and untickRows', () => {
  const key = 'HOLDING.PKID'
  const ticked = (...indexes) => indexes.map((i) => ({ row: holdings[i] }))

  it('adds the ticked rows after the ones already ticked', () => {
    const selection = { selectedKeys: [1], selectedRowData: [holdings[0]] }
    expect(tickRows(selection, ticked(2), key)).toEqual({ selectedKeys: [1, 3], selectedRowData: [holdings[0], holdings[2]] })
    expect(selection).toEqual({ selectedKeys: [1], selectedRowData: [holdings[0]] })
  })

  it('starts from nothing ticked when the slice has no selection yet', () => {
    expect(tickRows({}, ticked(1), key)).toEqual({ selectedKeys: [2], selectedRowData: [holdings[1]] })
    expect(untickRows({}, ticked(1), key)).toEqual({ selectedKeys: [], selectedRowData: [] })
  })

  it('takes the unticked rows out by their PKID', () => {
    const selection = tickRows({}, ticked(0, 1, 2), key)
    expect(untickRows(selection, [{ row: { ...holdings[1] } }, { row: holdings[2] }], key)).toEqual({
      selectedKeys: [1], selectedRowData: [holdings[0]]
    })
  })
})
