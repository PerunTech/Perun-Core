import { describe, expect, it } from 'vitest'
import { DEFAULT_MIN_COLUMN_WIDTH, SELECT_COLUMN_WIDTH, startingWidths } from '../../../../frontend/elements/grid/body/layout'

const widths = (columnWidths, gridWidth, reserved = 0) =>
  startingWidths(columnWidths.map((width) => ({ key: 'C', width })), gridWidth, DEFAULT_MIN_COLUMN_WIDTH, reserved)

describe('startingWidths', () => {
  it('shares the width equally among columns that fix none, rounded down', () => {
    expect(widths([undefined, undefined, undefined], 900)).toEqual([300, 300, 300])
    expect(widths([undefined, undefined, undefined], 1000)).toEqual([333, 333, 333])
  })

  it('shares what the fixed widths and the reserved width leave', () => {
    expect(widths([200, undefined, undefined], 800)).toEqual([200, 300, 300])
    expect(widths([undefined, undefined], 840, SELECT_COLUMN_WIDTH)).toEqual([400, 400])
  })

  it('reads a width in a string, in pixels or as a percentage of the grid', () => {
    expect(widths(['120', '120px', '25%', ' 12.5% ', undefined], 1000)).toEqual([120, 120, 250, 125, 385])
  })

  it('shares among columns whose width is not positive or cannot be read', () => {
    expect(widths([0, -5, 'auto', '0', null], 1000)).toEqual([200, 200, 200, 200, 200])
  })

  it('gives no column less than the narrowest it may be', () => {
    expect(widths(Array(10).fill(undefined), 500)).toEqual(Array(10).fill(DEFAULT_MIN_COLUMN_WIDTH))
    expect(widths([900, undefined], 800)).toEqual([900, DEFAULT_MIN_COLUMN_WIDTH])
  })

  it('keeps fixed widths as they are when every column fixes one', () => {
    expect(widths([100, 150], 1000)).toEqual([100, 150])
  })
})
