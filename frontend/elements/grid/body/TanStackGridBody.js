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
const OVERSCAN = 10

const NO_SELECTION = {}

const features = tableFeatures({ columnSizingFeature, columnResizingFeature, rowSelectionFeature })

// GenericGrid's drawing half; only the rows in view are in the page. The role and data-* attributes
// are hooks for tests and the deployments' sheets, independent of the look.
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
  // The filter row's key, so each clear from the no-match view draws it anew.
  const [filterClears, setFilterClears] = useState(0)

  // The columns share the viewport's width, so it is measured before first paint and on every change.
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
    // Ids are made unique (SVAROG_TABLES lists LABEL_CODE twice): React and TanStack's widths key on them.
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

  // TanStack works out what a click ticks, Shift ranges included; GenericGrid keeps the selection.
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

  // Kept apart from the widths so they stay the same through a resize.
  const cells = useMemo(() => tableColumns.map((def, idx) => ({
    id: def.id,
    idx,
    column: def.meta.column
  })), [tableColumns])

  const types = useMemo(() => cells.map((cell) => columnType(cell.column, rows)), [cells, rows])

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

  const {
    selectedCell, editing, activateCell, handleClick, handleContextMenu, handleDoubleClick, handleKeyDown, handleFocus,
    handleEditorCommit, handleEditorCancel, editorRect
  } = useActiveCell({ viewportRef, bodyRef, rows, rowKey, cells, widths, headerHeight, onRowClick, onRowsUpdated })

  // Memoized so a resize doesn't draw them again.
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
  // By PKID, so the highlight stays through a sort; by position for rows without one.
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
