/* The TanStack body's sizes, the layout it draws inline, and the widths its columns start at. */

/* Heights in pixels, as react-data-grid drew them. */
export const ROW_HEIGHT = 35
export const HEADER_ROW_HEIGHT = 50
export const FILTER_ROW_HEIGHT = 45
/* The grid's height when GenericGrid gives none (its `defaultHeight`), react-data-grid's default. */
export const DEFAULT_HEIGHT = 350
export const DEFAULT_MIN_COLUMN_WIDTH = 80
/* The multi-select column. It comes first, and counts in the column positions the context menu is
given, as react-data-grid's did. */
export const SELECT_COLUMN_ID = 'select-row'
export const SELECT_COLUMN_WIDTH = 40

/* The layout the grid cannot work without: the scrolling viewport, the header that stays at its top,
the rows placed where the virtualizer puts them, the cells side by side at their widths, and the
resize handle's hit area. Inline, so that the grid works on a page without the deployment's sheet.
The look, colours, borders, padding and type, is the deployment's (aims-assets' perun-grid.css),
which finds the parts by their perun-grid-* classes. */
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
  // Paint containment lets the browser keep what it painted for a cell that a resize only moves:
  // without it, each step of a resize on a wide grid paints every row in view again.
  cell: { display: 'flex', alignItems: 'center', flex: 'none', overflow: 'hidden', contain: 'paint' },
  select: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', margin: 0 },
  // The view drawn without rows, held to the viewport's width (given with it) and left edge, so that
  // it stays in sight on a grid whose columns scroll sideways.
  empty: { position: 'sticky', left: 0 }
}

/* A column's width in pixels when its config fixes one: a number, a number in a string, or a
percentage of the grid's width. Undefined for a column that shares what the fixed ones leave. */
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

/* The columns' widths before anyone resizes one, worked out as react-data-grid did: the fixed width
where the config sets one, and for the rest an equal share of what is left of the grid's width, but
never under the narrowest a column may be. */
export function startingWidths(columns, gridWidth, minColumnWidth, reserved) {
  const fixed = columns.map((column) => fixedWidth(column, gridWidth))
  const allocated = fixed.reduce((sum, width) => sum + (width || 0), reserved)
  const shared = fixed.filter((width) => width === undefined).length
  const share = shared > 0 ? Math.floor((gridWidth - allocated) / shared) : 0
  return fixed.map((width) => (width === undefined ? Math.max(minColumnWidth, share) : width))
}
