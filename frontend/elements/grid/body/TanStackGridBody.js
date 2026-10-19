import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  columnResizingFeature, columnSizingFeature, functionalUpdate, rowSelectionFeature, tableFeatures, useTable
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import CellEditor from './CellEditor';
import { ContextMenuTrigger } from '../chrome/ContextMenu';
import { columnType } from '../logic/columns';
import { filterApplied, filtersApplied } from '../logic/rows';
import {
  DEFAULT_HEIGHT, DEFAULT_MIN_COLUMN_WIDTH, FILTER_ROW_HEIGHT, HEADER_ROW_HEIGHT, LAYOUT, ROW_HEIGHT, SELECT_COLUMN_ID,
  SELECT_COLUMN_WIDTH, startingWidths
} from './layout';
import { FilterCell, GridRow, HeaderCell, NoMatchView } from './parts';
import useActiveCell from './useActiveCell';

/* Rows drawn past each edge of the viewport, so that a quick scroll does not show blank space. */
const OVERSCAN = 5

const NO_SELECTION = {}

const features = tableFeatures({ columnSizingFeature, columnResizingFeature, rowSelectionFeature })

/**
 * The part of GenericGrid that draws, on TanStack Table and TanStack Virtual, with its own markup
 * and perun-grid-* classes, styled by the deployment (see LAYOUT in layout.js). Only the rows in view
 * are in the page. It took react-data-grid's place with the same callbacks and the same arguments.
 *
 * GenericGrid keeps everything else: loading, the filters and the sort it applies to its rows, the
 * selected keys, the Redux slice and the callbacks its users pass. It renders its body through the
 * props below and nothing more.
 *
 * One cell is the active one, as react-data-grid's selected cell was: a click makes the clicked
 * cell active, and with the grid focused the arrows move it, stopping at the edges, and Tab and
 * Shift+Tab move it along the row and on to the next. A double click, Enter, Backspace, Delete or a
 * character typed opens the active cell's editor when its column is editable (see CellEditor for
 * the editors and their keys); a saved edit goes to `onRowsUpdated` with what react-data-grid gave
 * `onGridRowsUpdated`. react-data-grid's copying and pasting of cells, its handle for dragging a
 * value down a column and its Shift+arrow ranges are not here: they only ever fed
 * `handleRowUpdatedFunct`, which no grid is given.
 *
 * The parts carry attributes that do not depend on the look, for tests to find them by: the grid
 * `role="grid"`, a header cell `role="columnheader"` with `data-column-key` and `aria-sort`, its
 * sort control `data-action="sort"`, the filter row `data-part="filters"`, a row `role="row"` with
 * `data-row-key` (its PKID), `aria-selected` and `data-clicked="true"` when it is the row last
 * clicked, a cell `role="gridcell"` with `data-column-key` and `data-active="true"` when it is the
 * active cell, the multi-select boxes `data-part="select"` and `data-part="select-all"`, the
 * scrolling element `data-part="viewport"`, which takes the focus, the view drawn without rows
 * `data-part="empty"`, or `data-part="no-match"` when the filters left every row out, with its
 * button `data-action="clear-filters"`, and an open editor's box `.perun-grid-editor`, its input
 * `.editor-main`.
 *
 * Others are there for the deployment's sheet to style by: a header cell and the cells below it
 * carry `data-type` (`code`, `date` or `number`, see columnType in logic/columns.js), a code list cell
 * its stored value as `data-value`, a header cell `data-filtered="true"` while a filter is applied to
 * its column, and the toolbar is given `filtersOpen` for its filter row button.
 *
 * Clearing the filters from the no-match view leaves the filter row open with its boxes emptied and
 * the focus in the first of them; closing the row clears them as well, as it always has.
 *
 * Unlike react-data-grid, it shows the sort GenericGrid applies, a default sort included, and it
 * highlights the row last clicked by its PKID, so the highlight stays on that row through a sort.
 *
 * @param {Array} rows - The rows to draw, already filtered and sorted.
 * @param {string} rowKey - The key that holds each row's PKID.
 * @param {Array} columns - The grid's column config, with the editor, formatter and filterRenderer
 *   elements GenericGrid adds to it.
 * @param {number} height - The grid's height in pixels, or undefined for DEFAULT_HEIGHT.
 * @param {number} minColumnWidth - The narrowest a column may be, in pixels.
 * @param {element} toolbar - Drawn above the grid, with `onToggleFilter`, `filtersOpen` and
 *   `numberOfRows` added.
 * @param {string} sortColumn - The column the rows are sorted by, which its header shows.
 * @param {string} sortDirection - `ASC`, `DESC` or `NONE`.
 * @param {function} onSort - `(columnKey, direction)`, when a header asks for another sort.
 * @param {object} filters - The filters GenericGrid applies, by column key; their headers are marked.
 * @param {function} onFilterChange - `(filter)`, when a cell of the filter row changes; the filter is
 *   `{ column, filterTerm }`.
 * @param {function} onClearFilters - When the filter row is closed, or cleared from the no-match view.
 * @param {function} getFilterOptions - `(columnKey)`, the options a code list column's filter offers.
 * @param {function} onRowClick - `(rowIdx, row)`; the index is the row's position as drawn.
 * @param {function} onRowsUpdated - `({ fromRow, toRow, updated })`, when an edited cell is saved.
 * @param {object} clickedRow - The row last clicked, carrying its position as `ROW_ID`, or undefined.
 * @param {object} selection - Null without multi-select, else `{ selectedKeys, onRowsSelected,
 *   onRowsDeselected }`; the two callbacks receive `[{ rowIdx, row }]`.
 * @param {element} contextMenu - The right-click menu, given the clicked cell's `rowIdx` and `idx`.
 * @param {element|function} emptyView - The element, or component, drawn when there are no rows.
 */
export default function TanStackGridBody({
  rows, rowKey, columns, height, minColumnWidth, toolbar, sortColumn, sortDirection, onSort, filters,
  onFilterChange, onClearFilters, getFilterOptions, onRowClick, onRowsUpdated, clickedRow, selection,
  contextMenu, emptyView
}) {
  const viewportRef = useRef(null)
  const bodyRef = useRef(null)
  const filterRowRef = useRef(null)
  const [gridWidth, setGridWidth] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Counts the clears from the no-match view; the filter row's key, so that each draws it anew, empty.
  const [filterClears, setFilterClears] = useState(0)

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

  /* The columns' types, by position: worked out again only when the rows or the columns change, which
  a click on a row does not. */
  const types = useMemo(() => cells.map((cell) => columnType(cell.column, rows)), [cells, rows])

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

  // The active cell and its editor, with the clicks, keys and focus that move or open them.
  const {
    selectedCell, editing, activateCell, handleClick, handleContextMenu, handleDoubleClick, handleKeyDown, handleFocus,
    handleEditorCommit, handleEditorCancel, editorRect
  } = useActiveCell({ viewportRef, bodyRef, rows, rowKey, cells, widths, headerHeight, onRowClick, onRowsUpdated })

  /* The toolbar and the context menu are made here once for what they show, rather than on each
  render, so that a resize does not draw them again. */
  const toolbarElement = useMemo(() => toolbar && React.cloneElement(toolbar, {
    onToggleFilter: () => {
      if (filtersOpen && onClearFilters) {
        onClearFilters()
      }
      setFiltersOpen(!filtersOpen)
    },
    filtersOpen,
    numberOfRows: rows.length
  }), [toolbar, filtersOpen, onClearFilters, rows.length])
  const contextMenuElement = useMemo(() => contextMenu && React.cloneElement(contextMenu, selectedCell), [contextMenu, selectedCell])

  const clearFilters = () => {
    if (onClearFilters) {
      onClearFilters()
    }
    setFilterClears(filterClears + 1)
  }

  // The button that cleared them is gone with the view, so the focus goes on to the first filter.
  useEffect(() => {
    const input = filterClears > 0 && filterRowRef.current && filterRowRef.current.querySelector('input:not([type="hidden"])')
    if (input) {
      input.focus()
    }
  }, [filterClears])

  const clickedKey = clickedRow ? clickedRow[rowKey] : undefined
  // By PKID, or by position for rows without one, as react-data-grid always did.
  const isClicked = (row, rowIdx) => Boolean(clickedRow) && (clickedKey !== undefined && clickedKey !== null
    ? row[rowKey] === clickedKey
    : clickedRow.ROW_ID === rowIdx)

  const tableRows = table.getRowModel().rows
  const body = (
    <div
      ref={bodyRef}
      role='rowgroup'
      className='perun-grid-body'
      style={{ ...LAYOUT.body, height: virtualizer.getTotalSize() }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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
            types={types}
            selected={Boolean(rowSelection[rowId])}
            clicked={isClicked(row, item.index)}
            activeIdx={selectedCell.rowIdx === item.index ? selectedCell.idx : -1}
            tableRow={hasSelection ? tableRows[item.index] : undefined}
            onSelectCell={activateCell}
          />
        )
      })}
    </div>
  )
  const emptyStyle = { ...LAYOUT.empty, width: gridWidth || undefined }

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
        <div
          ref={viewportRef}
          role='presentation'
          tabIndex={0}
          data-part='viewport'
          className='perun-grid-viewport'
          style={LAYOUT.viewport}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        >
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
                      type={types[idx]}
                      filtered={filterApplied(filters && filters[column.key])}
                      onSort={onSort}
                    />
                  )
                })}
              </div>
              {filtersOpen && (
                <div
                  key={filterClears}
                  ref={filterRowRef}
                  role='row'
                  aria-rowindex={2}
                  data-part='filters'
                  className='perun-grid-filter-row'
                  style={LAYOUT.filterRow}
                >
                  {cells.map((cell) => (
                    <FilterCell key={cell.id} cell={cell} width={widths[cell.idx]} onFilterChange={onFilterChange} getFilterOptions={getFilterOptions} />
                  ))}
                </div>
              )}
            </div>
            {rows.length > 0 && (
              contextMenu ? <ContextMenuTrigger id={contextMenu.props.id}>{body}</ContextMenuTrigger> : body
            )}
            {rows.length === 0 && (filtersApplied(filters) ? (
              <div data-part='no-match' className='perun-grid-no-match' style={emptyStyle}>
                <NoMatchView onClearFilters={clearFilters} />
              </div>
            ) : (
              <div data-part='empty' className='perun-grid-empty' style={emptyStyle}>
                {React.isValidElement(emptyView) ? emptyView : emptyView && React.createElement(emptyView)}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Only beside rows, which are all it opens on, as react-data-grid drew it. */}
      {rows.length > 0 && contextMenuElement}
      {editing && rows[editing.rowIdx] && cells[editing.idx] && (
        <CellEditor
          key={`${editing.rowIdx}:${editing.idx}`}
          column={cells[editing.idx].column}
          row={rows[editing.rowIdx]}
          value={rows[editing.rowIdx][cells[editing.idx].column.key]}
          firstKey={editing.firstKey}
          viewport={viewportRef.current}
          getRect={editorRect}
          onCommit={handleEditorCommit}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  )
}
