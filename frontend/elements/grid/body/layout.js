export const ROW_HEIGHT = 35
export const HEADER_ROW_HEIGHT = 50
export const FILTER_ROW_HEIGHT = 45
export const DEFAULT_HEIGHT = 350
export const DEFAULT_MIN_COLUMN_WIDTH = 80
// Comes first, and counts in the column positions the context menu is given.
export const SELECT_COLUMN_ID = 'select-row'
export const SELECT_COLUMN_WIDTH = 40

// Only what the grid can't work without, inline so it works without the deployment's sheet; the look
// is the deployment's (aims-assets' perun-grid.css).
export const LAYOUT = {
  // Below the toolbar's buttons, which it floats right; beside them the viewport would narrow.
  grid: { position: 'relative', clear: 'both' },
  viewport: { position: 'relative', height: '100%', overflow: 'auto' },
  canvas: { position: 'relative', minWidth: '100%' },
  head: { position: 'sticky', top: 0, zIndex: 2 },
  headerRow: { display: 'flex', height: HEADER_ROW_HEIGHT },
  filterRow: { display: 'flex', height: FILTER_ROW_HEIGHT },
  headerCell: { position: 'relative', display: 'flex', alignItems: 'center', flex: 'none', overflow: 'hidden' },
  // Left visible, so that a code list filter's menu can open over the rows.
  filterCell: { display: 'flex', alignItems: 'center', flex: 'none', overflow: 'visible' },
  resizer: { position: 'absolute', top: 0, right: 0, zIndex: 1, width: 6, height: '100%', cursor: 'col-resize', touchAction: 'none' },
  body: { position: 'relative' },
  row: { position: 'absolute', top: 0, left: 0, display: 'flex', width: '100%', height: ROW_HEIGHT },
  // Lets the browser keep a cell's paint when a resize only moves it; without it every row repaints.
  cell: { display: 'flex', alignItems: 'center', flex: 'none', overflow: 'hidden', contain: 'paint' },
  select: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', margin: 0 },
  // Sticky, so it stays in sight on a grid whose columns scroll sideways.
  empty: { position: 'sticky', left: 0 }
}

// A number, a number in a string, or a percentage of the grid's width; undefined to share the rest.
function fixedWidth(column, gridWidth) {
  const { width } = column
  if (typeof width === 'number') {
    return width > 0 ? width : undefined
  }
  if (typeof width === 'string') {
    const percent = /^(\d+(?:\.\d+)?)%$/.exec(width.trim())
    if (percent) {
      return Math.floor(Number(percent[1]) / 100 * gridWidth)
    }
    const pixels = parseFloat(width)
    return pixels > 0 ? pixels : undefined
  }
  return undefined
}

// The fixed widths, and for the rest an equal share of what is left, never under the minimum.
export function startingWidths(columns, gridWidth, minColumnWidth, reserved) {
  const fixed = columns.map((column) => fixedWidth(column, gridWidth))
  const allocated = fixed.reduce((sum, width) => sum + (width || 0), reserved)
  const shared = fixed.filter((width) => width === undefined).length
  const share = shared > 0 ? Math.floor((gridWidth - allocated) / shared) : 0
  return fixed.map((width) => (width === undefined ? Math.max(minColumnWidth, share) : width))
}
