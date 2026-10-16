import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  columnResizingFeature, columnSizingFeature, functionalUpdate, rowSelectionFeature, tableFeatures, useTable
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '..';
import { ContextMenuTrigger } from './ContextMenu';
import TextFilter from './TextFilter';

/* Heights in pixels, as react-data-grid drew them. */
const ROW_HEIGHT = 35
const HEADER_ROW_HEIGHT = 50
const FILTER_ROW_HEIGHT = 45
/* The grid's height when GenericGrid gives none (its `defaultHeight`), react-data-grid's default. */
const DEFAULT_HEIGHT = 350
const DEFAULT_MIN_COLUMN_WIDTH = 80
/* The multi-select column. It comes first, and counts in the column positions the context menu is
given, as react-data-grid's did. */
const SELECT_COLUMN_ID = 'select-row'
const SELECT_COLUMN_WIDTH = 40
/* Rows drawn past each edge of the viewport, so that a quick scroll does not show blank space. */
const OVERSCAN = 5

const SORT_ICONS = { ASC: 'IconArrowUp', DESC: 'IconArrowDown' }
const ARIA_SORT = { ASC: 'ascending', DESC: 'descending' }
const NO_SELECTION = {}
const NO_CELL = { rowIdx: -1, idx: -1 }

/* The layout the grid cannot work without: the scrolling viewport, the header that stays at its top,
the rows placed where the virtualizer puts them, the cells side by side at their widths, and the
resize handle's hit area. Inline, so that the grid works on a page without the deployment's sheet.
The look, colours, borders, padding and type, is the deployment's (aims-assets' perun-grid.css),
which finds the parts by their perun-grid-* classes. */
const LAYOUT = {
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
  select: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', margin: 0 }
}

const features = tableFeatures({ columnSizingFeature, columnResizingFeature, rowSelectionFeature })

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
function startingWidths(columns, gridWidth, minColumnWidth, reserved) {
  const fixed = columns.map((column) => fixedWidth(column, gridWidth))
  const allocated = fixed.reduce((sum, width) => sum + (width || 0), reserved)
  const shared = fixed.filter((width) => width === undefined).length
  const share = shared > 0 ? Math.floor((gridWidth - allocated) / shared) : 0
  return fixed.map((width) => (width === undefined ? Math.max(minColumnWidth, share) : width))
}

/* A column's name with a line break allowed after each underscore, so that a field name such as
WORKFLOW_ITEM_NAME wraps between its words when the deployment gives the header a second line. The
breaks are <wbr> elements, which add no text: the name reads, copies and matches as it stands. */
function headerName(name) {
  if (typeof name !== 'string' || !name.includes('_')) {
    return name
  }
  const parts = name.split('_')
  return parts.map((part, i) => (i < parts.length - 1
    ? <React.Fragment key={i}>{part}_<wbr /></React.Fragment>
    : part))
}

/* The direction a click on a header asks for next: ascending, descending, then none, or descending
first for a column with `sortDescendingFirst`, in react-data-grid's cycle. */
function nextSortDirection(direction, descendingFirst) {
  switch (direction) {
    case 'ASC':
      return descendingFirst ? 'NONE' : 'DESC'
    case 'DESC':
      return descendingFirst ? 'ASC' : 'NONE'
    default:
      return descendingFirst ? 'DESC' : 'ASC'
  }
}

/* A cell's content: the column's formatter, given what react-data-grid gave it, or else the value as
text, as react-data-grid's own formatter drew it. */
function cellContent(column, row, rowIdx) {
  const value = row[column.key]
  const { formatter } = column
  if (React.isValidElement(formatter)) {
    return React.cloneElement(formatter, { value, column, rowIdx, row })
  }
  if (typeof formatter === 'function') {
    return React.createElement(formatter, { value, row })
  }
  const text = typeof value === 'string' || typeof value === 'number' ? value : undefined
  return <div title={text}>{text}</div>
}

/* The cell and row a click landed in, read from the attributes the rows carry, or null for a click
outside any cell. */
function cellAt(target) {
  const cell = target instanceof Element ? target.closest('[data-idx]') : null
  const row = cell ? cell.closest('[data-row-index]') : null
  if (!row) {
    return null
  }
  return { rowIdx: Number(row.getAttribute('data-row-index')), idx: Number(cell.getAttribute('data-idx')) }
}

/* A cell with a column's value. Drawn again only when its row or its width changes, so that a step
of a resize draws the cells of the column being dragged and leaves the others as they are. */
const GridCell = React.memo(function GridCell({ cell, width, row, rowIdx }) {
  return (
    <div
      role='gridcell'
      data-column-key={cell.id}
      data-idx={cell.idx}
      className={classNames('perun-grid-cell', cell.column.cellClass)}
      style={{ ...LAYOUT.cell, width }}
    >
      {cellContent(cell.column, row, rowIdx)}
    </div>
  )
})

/* A row's multi-select box. A click here ticks the box and is not a click on the row, as in
react-data-grid. */
const SelectCell = React.memo(function SelectCell({ cell, width, rowIdx, selected, tableRow, onSelectCell }) {
  return (
    <div
      role='gridcell'
      data-part='select'
      data-idx={cell.idx}
      className='perun-grid-cell perun-grid-cell--select'
      style={{ ...LAYOUT.cell, width }}
      onClick={(event) => {
        event.stopPropagation()
        onSelectCell({ rowIdx, idx: cell.idx })
      }}
    >
      <label className='perun-grid-select' style={LAYOUT.select}>
        <input type='checkbox' checked={selected} onChange={(event) => tableRow.getToggleSelectedHandler()(event)} />
      </label>
    </div>
  )
})

/* One row as drawn. Only the rows that change are drawn again: scrolling only adds rows and takes
others away, so a row's props stay the same while it is on screen. A resize gives every row new
widths, but within each only the cells whose width changed are drawn again. */
const GridRow = React.memo(function GridRow({
  row, rowIdx, rowId, ariaRowIndex, top, cells, widths, selected, clicked, tableRow, onSelectCell
}) {
  return (
    <div
      role='row'
      aria-rowindex={ariaRowIndex}
      aria-selected={tableRow ? selected : undefined}
      data-row-key={rowId}
      data-row-index={rowIdx}
      data-clicked={clicked ? 'true' : undefined}
      className={classNames('perun-grid-row', rowIdx % 2 === 1 && 'perun-grid-row--odd', {
        'perun-grid-row--selected': selected,
        'perun-grid-row--clicked': clicked
      }, row.additionalClassName)}
      style={{ ...LAYOUT.row, transform: `translateY(${top}px)` }}
    >
      {cells.map((cell) => (cell.column ? (
        <GridCell key={cell.id} cell={cell} width={widths[cell.idx]} row={row} rowIdx={rowIdx} />
      ) : (
        <SelectCell
          key={cell.id}
          cell={cell}
          width={widths[cell.idx]}
          rowIdx={rowIdx}
          selected={selected}
          tableRow={tableRow}
          onSelectCell={onSelectCell}
        />
      )))}
    </div>
  )
})

/* A column's header cell: its name, the sort control when it sorts, and the resize handle when it
resizes. Drawn again only when its width, its sort or its resizing state changes. */
const HeaderCell = React.memo(function HeaderCell({ cell, width, header, direction, resizing, onSort }) {
  const { column } = cell
  return (
    <div
      role='columnheader'
      data-column-key={cell.id}
      aria-sort={column.sortable ? ARIA_SORT[direction] || 'none' : undefined}
      className={classNames('perun-grid-header-cell', { 'perun-grid-header-cell--sorted': direction !== 'NONE' })}
      style={{ ...LAYOUT.headerCell, width }}
    >
      {column.sortable ? (
        <button
          type='button'
          data-action='sort'
          className='perun-grid-sort'
          onClick={() => onSort(column.key, nextSortDirection(direction, column.sortDescendingFirst))}
        >
          <span className='perun-grid-header-text' title={column.name}>{headerName(column.name)}</span>
          {SORT_ICONS[direction] && (
            <span className='perun-grid-sort-arrow' aria-hidden='true'>
              <Icon name={SORT_ICONS[direction]} size={16} stroke={2} />
            </span>
          )}
        </button>
      ) : (
        <span className='perun-grid-header-text' title={column.name}>{headerName(column.name)}</span>
      )}
      {header.column.getCanResize() && (
        <div
          className={classNames('perun-grid-resizer', { 'perun-grid-resizer--active': resizing })}
          style={LAYOUT.resizer}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
        />
      )}
    </div>
  )
})

/* A column's cell in the filter row, with the column's filter when it filters. */
const FilterCell = React.memo(function FilterCell({ cell, width, onFilterChange, getFilterOptions }) {
  const Filter = cell.column && cell.column.filterable ? cell.column.filterRenderer || TextFilter : null
  return (
    <div role='gridcell' data-column-key={cell.id} className='perun-grid-filter-cell' style={{ ...LAYOUT.filterCell, width }}>
      {Filter && <Filter column={cell.column} onChange={onFilterChange} getValidFilterValues={getFilterOptions} />}
    </div>
  )
})

/**
 * The part of GenericGrid that draws, on TanStack Table and TanStack Virtual, in place of
 * ReactDataGridBody: the same props, the same callbacks with the same arguments, and its own markup
 * and perun-grid-* classes, styled by the deployment (see LAYOUT). Only the rows in view are in the
 * page.
 *
 * It does not edit yet: cells are read-only, and `onRowsUpdated` is never called.
 *
 * The parts carry attributes that do not depend on the look, for tests to find them by: the grid
 * `role="grid"`, a header cell `role="columnheader"` with `data-column-key` and `aria-sort`, its
 * sort control `data-action="sort"`, the filter row `data-part="filters"`, a row `role="row"` with
 * `data-row-key` (its PKID), `aria-selected` and `data-clicked="true"` when it is the row last
 * clicked, a cell `role="gridcell"` with `data-column-key`, the multi-select boxes
 * `data-part="select"` and `data-part="select-all"`, the scrolling element `data-part="viewport"`,
 * and the view drawn without rows `data-part="empty"`.
 *
 * Unlike react-data-grid, it shows the sort GenericGrid applies, a default sort included, and it
 * highlights the row last clicked by its PKID, so the highlight stays on that row through a sort.
 * See ReactDataGridBody for the props.
 */
export default function TanStackGridBody({
  rows, rowKey, columns, height, minColumnWidth, toolbar, sortColumn, sortDirection, onSort,
  onFilterChange, onClearFilters, getFilterOptions, onRowClick, clickedRow, selection, contextMenu,
  emptyView
}) {
  const viewportRef = useRef(null)
  const [gridWidth, setGridWidth] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState(NO_CELL)

  /* The columns share the viewport's width, so it is measured before the grid is first shown and
  again whenever it changes. */
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const measure = () => setGridWidth(viewport.clientWidth)
    measure()
    if (typeof ResizeObserver !== 'function') {
      return undefined
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const hasSelection = Boolean(selection)
  const selectedKeys = selection ? selection.selectedKeys : undefined
  const minWidth = minColumnWidth || DEFAULT_MIN_COLUMN_WIDTH

  const getRowId = useCallback((row, index) => {
    const key = row[rowKey]
    return key === undefined || key === null ? `#${index}` : String(key)
  }, [rowKey])

  const tableColumns = useMemo(() => {
    const widths = startingWidths(columns, gridWidth, minWidth, hasSelection ? SELECT_COLUMN_WIDTH : 0)
    /* A column's id is its key, with a count added when the config repeats a key, as some tables'
    metadata does (SVAROG_TABLES lists LABEL_CODE twice): React tells the cells apart by it, and
    TanStack keeps a width per id, so a repeated id would draw the wrong cells and resize both. */
    const seen = {}
    const defs = columns.map((column, i) => {
      const repeats = seen[column.key] || 0
      seen[column.key] = repeats + 1
      return {
        id: repeats > 0 ? `${column.key}#${repeats}` : column.key,
        size: widths[i],
        minSize: Math.min(minWidth, widths[i]),
        enableResizing: column.resizable === true,
        meta: { column }
      }
    })
    return hasSelection
      ? [{ id: SELECT_COLUMN_ID, size: SELECT_COLUMN_WIDTH, minSize: SELECT_COLUMN_WIDTH, enableResizing: false, meta: {} }, ...defs]
      : defs
  }, [columns, gridWidth, minWidth, hasSelection])

  const rowSelection = useMemo(() => {
    if (!selectedKeys) {
      return NO_SELECTION
    }
    const selected = {}
    selectedKeys.forEach((key) => { selected[String(key)] = true })
    return selected
  }, [selectedKeys])

  /* TanStack works out which rows a click ticks or clears, a Shift range included; GenericGrid
  keeps the selection, and is told what changed with the rows in the order they are drawn, as
  react-data-grid told it. */
  const handleRowSelectionChange = (updater) => {
    const next = functionalUpdate(updater, rowSelection)
    const added = []
    const removed = []
    rows.forEach((row, rowIdx) => {
      const id = getRowId(row, rowIdx)
      if (next[id] && !rowSelection[id]) {
        added.push({ rowIdx, row })
      } else if (!next[id] && rowSelection[id]) {
        removed.push({ rowIdx, row })
      }
    })
    if (removed.length > 0) {
      selection.onRowsDeselected(removed)
    }
    if (added.length > 0) {
      selection.onRowsSelected(added)
    }
  }

  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId,
    columnResizeMode: 'onChange',
    enableRowSelection: hasSelection,
    state: { rowSelection },
    onRowSelectionChange: handleRowSelectionChange
  })

  /* The columns as the rows draw them, kept apart from their widths so that they stay the same
  through a resize. */
  const cells = useMemo(() => tableColumns.map((def, idx) => ({
    id: def.id,
    idx,
    column: def.meta.column
  })), [tableColumns])

  /* Each column's width as TanStack's column.getSize() works it out, from the widths a resize left
  in the sizing state. */
  const { columnSizing, columnResizing } = table.state
  const widths = useMemo(
    () => tableColumns.map((def) => Math.max(def.minSize, columnSizing[def.id] ?? def.size)),
    [tableColumns, columnSizing]
  )
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
  const headers = table.getHeaderGroups()[0].headers

  const [allSelected, someSelected] = useMemo(() => {
    if (!hasSelection || rows.length === 0) {
      return [false, false]
    }
    let count = 0
    rows.forEach((row, i) => { if (rowSelection[getRowId(row, i)]) count += 1 })
    return [count === rows.length, count > 0]
  }, [hasSelection, rows, rowSelection, getRowId])

  const headerRowCount = filtersOpen ? 2 : 1
  const headerHeight = HEADER_ROW_HEIGHT + (filtersOpen ? FILTER_ROW_HEIGHT : 0)
  const gridHeight = height > 0 ? height : DEFAULT_HEIGHT
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin: headerHeight,
    initialRect: { width: 0, height: gridHeight }
  })

  /* The toolbar and the context menu are made here once for what they show, rather than on each
  render, so that a resize does not draw them again. */
  const toolbarElement = useMemo(() => toolbar && React.cloneElement(toolbar, {
    onToggleFilter: () => {
      if (filtersOpen && onClearFilters) {
        onClearFilters()
      }
      setFiltersOpen(!filtersOpen)
    },
    numberOfRows: rows.length
  }), [toolbar, filtersOpen, onClearFilters, rows.length])
  const contextMenuElement = useMemo(() => contextMenu && React.cloneElement(contextMenu, selectedCell), [contextMenu, selectedCell])

  const handleClick = (event) => {
    const cell = cellAt(event.target)
    if (cell) {
      setSelectedCell(cell)
      if (onRowClick) {
        onRowClick(cell.rowIdx, rows[cell.rowIdx])
      }
    }
  }

  // Before the menu opens, so that it reads the row and column it was opened on.
  const handleContextMenu = (event) => {
    const cell = cellAt(event.target)
    if (cell) {
      setSelectedCell(cell)
    }
  }

  const clickedKey = clickedRow ? clickedRow[rowKey] : undefined
  // By PKID, or by position for rows without one, as react-data-grid always did.
  const isClicked = (row, rowIdx) => Boolean(clickedRow) && (clickedKey !== undefined && clickedKey !== null
    ? row[rowKey] === clickedKey
    : clickedRow.ROW_ID === rowIdx)

  const tableRows = table.getRowModel().rows
  const body = (
    <div
      role='rowgroup'
      className='perun-grid-body'
      style={{ ...LAYOUT.body, height: virtualizer.getTotalSize() }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]
        const rowId = getRowId(row, item.index)
        return (
          <GridRow
            key={rowId}
            row={row}
            rowIdx={item.index}
            rowId={rowId}
            ariaRowIndex={item.index + headerRowCount + 1}
            top={item.start - headerHeight}
            cells={cells}
            widths={widths}
            selected={Boolean(rowSelection[rowId])}
            clicked={isClicked(row, item.index)}
            tableRow={hasSelection ? tableRows[item.index] : undefined}
            onSelectCell={setSelectedCell}
          />
        )
      })}
    </div>
  )

  return (
    <div className='perun-grid-container'>
      {toolbarElement}
      <div
        role='grid'
        aria-rowcount={rows.length + headerRowCount}
        aria-colcount={cells.length}
        aria-multiselectable={hasSelection || undefined}
        className={classNames('perun-grid', { 'perun-grid--resizing': Boolean(columnResizing.isResizingColumn) })}
        style={{ ...LAYOUT.grid, height: gridHeight }}
      >
        <div ref={viewportRef} role='presentation' data-part='viewport' className='perun-grid-viewport' style={LAYOUT.viewport}>
          <div role='presentation' className='perun-grid-canvas' style={{ ...LAYOUT.canvas, width: totalWidth }}>
            <div role='rowgroup' className='perun-grid-head' style={LAYOUT.head}>
              <div role='row' aria-rowindex={1} className='perun-grid-header-row' style={LAYOUT.headerRow}>
                {headers.map((header, idx) => {
                  const cell = cells[idx]
                  if (!cell.column) {
                    return (
                      <div
                        key={cell.id}
                        role='columnheader'
                        data-part='select-all'
                        data-column-key={cell.id}
                        className='perun-grid-header-cell perun-grid-header-cell--select'
                        style={{ ...LAYOUT.headerCell, width: widths[idx] }}
                      >
                        <label className='perun-grid-select' style={LAYOUT.select}>
                          <input
                            type='checkbox'
                            checked={allSelected}
                            ref={(input) => { if (input) input.indeterminate = someSelected && !allSelected }}
                            onChange={table.getToggleAllRowsSelectedHandler()}
                          />
                        </label>
                      </div>
                    )
                  }
                  const { column } = cell
                  const direction = sortColumn === column.key && sortDirection !== 'NONE' ? sortDirection || 'DESC' : 'NONE'
                  return (
                    <HeaderCell
                      key={cell.id}
                      cell={cell}
                      width={widths[idx]}
                      header={header}
                      direction={direction}
                      resizing={columnResizing.isResizingColumn === cell.id}
                      onSort={onSort}
                    />
                  )
                })}
              </div>
              {filtersOpen && (
                <div role='row' aria-rowindex={2} data-part='filters' className='perun-grid-filter-row' style={LAYOUT.filterRow}>
                  {cells.map((cell) => (
                    <FilterCell key={cell.id} cell={cell} width={widths[cell.idx]} onFilterChange={onFilterChange} getFilterOptions={getFilterOptions} />
                  ))}
                </div>
              )}
            </div>
            {rows.length > 0 ? (
              contextMenu ? <ContextMenuTrigger id={contextMenu.props.id}>{body}</ContextMenuTrigger> : body
            ) : (
              <div data-part='empty' className='perun-grid-empty'>
                {React.isValidElement(emptyView) ? emptyView : emptyView && React.createElement(emptyView)}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Only beside rows, which are all it opens on, as react-data-grid drew it. */}
      {rows.length > 0 && contextMenuElement}
    </div>
  )
}
