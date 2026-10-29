import { describe, expect, it } from 'vitest'
import { exportRows, prepJsonFromConf } from '../../../../frontend/elements/grid/logic/exportRows'

const STATUS = [{ id: 'ACTIVE', value: 'ACTIVE', text: 'Active' }, { id: 'PASSIVE', value: 'PASSIVE', text: 'Passive' }]
const gridConfig = [
  { key: 'NAME', name: 'Name' },
  { key: 'STATUS', name: 'Status', formatterOptions: STATUS },
  { key: 'ANIMALS', name: 'Animals' }
]
const rows = [
  { 'HOLDING.PKID': 1, NAME: 'Kumanovo farm', STATUS: 'ACTIVE', ANIMALS: 12 },
  { 'HOLDING.PKID': 2, NAME: 'Bitola dairy', STATUS: 'PASSIVE', ANIMALS: 0 },
  { 'HOLDING.PKID': 3, NAME: '', STATUS: null }
]
const FILTER_BY = 'Filtered by'

describe('prepJsonFromConf', () => {
  it("keys each row by the columns' names, with code list values decoded", () => {
    expect(prepJsonFromConf(gridConfig, rows.slice(0, 2))).toEqual([
      { Name: 'Kumanovo farm', Status: 'Active', Animals: 12 },
      { Name: 'Bitola dairy', Status: 'Passive', Animals: 0 }
    ])
  })

  it('writes a space for an empty cell and leaves out fields the config does not name', () => {
    expect(prepJsonFromConf(gridConfig, [rows[2]])).toEqual([{ Name: ' ', Status: ' ', Animals: ' ' }])
  })

  it('returns no rows without a config or rows', () => {
    expect(prepJsonFromConf(undefined, rows)).toEqual([])
    expect(prepJsonFromConf(gridConfig, undefined)).toEqual([])
  })
})

describe('exportRows', () => {
  const statusColumn = { key: 'STATUS', name: 'Status' }
  const nameColumn = { key: 'NAME', name: 'Name' }

  it('exports every row while no filter is set', () => {
    expect(exportRows({ gridConfig, rows, filters: [] }, FILTER_BY)).toHaveLength(3)
    expect(exportRows({ gridConfig, rows, filters: {} }, FILTER_BY)).toHaveLength(3)
  })

  it('exports the filtered rows, then a row per value picked in a code list filter', () => {
    const filters = {
      STATUS: { column: statusColumn, filterTerm: [{ value: 'ACTIVE', label: 'Active' }, { value: 'PASSIVE', label: 'Passive' }] }
    }
    expect(exportRows({ gridConfig, rows, filters, filteredRows: rows.slice(0, 2) }, FILTER_BY)).toEqual([
      { Name: 'Kumanovo farm', Status: 'Active', Animals: 12 },
      { Name: 'Bitola dairy', Status: 'Passive', Animals: 0 },
      { 'Filtered by: Status': 'Active' },
      { 'Filtered by: Status': 'Passive' }
    ])
  })

  it("adds a single row with a text filter's text", () => {
    const filters = { NAME: { column: nameColumn, filterTerm: 'farm' } }
    expect(exportRows({ gridConfig, rows, filters, filteredRows: rows.slice(0, 1) }, FILTER_BY)).toEqual([
      { Name: 'Kumanovo farm', Status: 'Active', Animals: 12 },
      { 'Filtered by: Name': 'farm' }
    ])
  })

  it('adds no row for a code list filter whose picks were all taken out again', () => {
    const filters = { STATUS: { column: statusColumn, filterTerm: [] } }
    expect(exportRows({ gridConfig, rows, filters, filteredRows: rows }, FILTER_BY)).toHaveLength(3)
  })

  it('exports nothing when there are no rows to export', () => {
    const filters = { NAME: { column: nameColumn, filterTerm: 'Struga' } }
    expect(exportRows({ gridConfig, rows, filters, filteredRows: [] }, FILTER_BY)).toEqual([])
    expect(exportRows({ gridConfig, rows: [], filters: [] }, FILTER_BY)).toEqual([])
  })
})
