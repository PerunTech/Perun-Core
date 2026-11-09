import { describe, expect, it } from 'vitest'
import { shownExports } from '../../../../frontend/elements/grid/logic/hiddenExports'

const EXPORTS = [{ format: 'csv' }, { format: 'xls' }, { format: 'xlsx' }]
const formats = (hidden) => shownExports(EXPORTS, hidden).map(({ format }) => format)

describe('shownExports', () => {
  it('shows every export when nothing is hidden', () => {
    expect(formats(undefined)).toEqual(['csv', 'xls', 'xlsx'])
    expect(formats(null)).toEqual(['csv', 'xls', 'xlsx'])
    expect(formats(false)).toEqual(['csv', 'xls', 'xlsx'])
    expect(formats([])).toEqual(['csv', 'xls', 'xlsx'])
  })

  it('hides every export for true', () => {
    expect(formats(true)).toEqual([])
  })

  it('hides the formats a list names, in any case, keeping the order', () => {
    expect(formats(['xls'])).toEqual(['csv', 'xlsx'])
    expect(formats(['XLSX', 'Csv'])).toEqual(['xls'])
    expect(formats(['csv', 'xls', 'xlsx'])).toEqual([])
  })

  it('takes a single format name as a list of one', () => {
    expect(formats('xls')).toEqual(['csv', 'xlsx'])
  })

  it('ignores names that are not a format', () => {
    expect(formats(['pdf', '.xls'])).toEqual(['csv', 'xls', 'xlsx'])
  })
})
