import React from 'react';
import ReactDataGrid from 'react-data-grid';
import { ContextMenuTrigger } from './ContextMenu';
import { customRowRenderer } from './RowRenderer';
import { customRowRendererSecondary } from './RowRendererSecondary';

/* How tall the header row is, in pixels. */
const HEADER_ROW_HEIGHT = 50

/**
 * The part of GenericGrid that draws, on react-data-grid 5.
 *
 * GenericGrid keeps everything else: loading, the filters and the sort it applies to its rows, the
 * selected keys, the Redux slice and the callbacks its users pass. It renders its body through the
 * props below and nothing more, so that a body built on another library can take this one's place
 * (stage 5 of the modernization plan; see the GenericGrid replacement spec).
 *
 * @param {Array} rows - The rows to draw, already filtered and sorted.
 * @param {string} rowKey - The key that holds each row's PKID.
 * @param {Array} columns - The grid's column config, with the editor, formatter and filterRenderer
 *   elements GenericGrid adds to it.
 * @param {number} height - The grid's height in pixels, or undefined for react-data-grid's own.
 * @param {number} minColumnWidth - The narrowest a column may be, in pixels.
 * @param {string} className - Passed through to the grid.
 * @param {element} toolbar - Drawn above the grid, with `onToggleFilter` and `numberOfRows` added.
 * @param {string} sortColumn - The column the rows are sorted by. Not shown here: react-data-grid 5
 *   keeps the header's arrow in its own state, as GenericGrid always left it.
 * @param {string} sortDirection - `ASC`, `DESC` or `NONE`, likewise not shown here.
 * @param {function} onSort - `(columnKey, direction)`, when a header asks for another sort.
 * @param {function} onFilterChange - `(filter)`, when a cell of the filter row changes; the filter is
 *   `{ column, filterTerm }`.
 * @param {function} onClearFilters - When the filter row is closed.
 * @param {function} getFilterOptions - `(columnKey)`, the options a code list column's filter offers.
 * @param {function} onRowClick - `(rowIdx, row)`; the index is the row's position as drawn.
 * @param {function} onRowsUpdated - `({ fromRow, toRow, updated })`, when an edited cell is committed.
 * @param {object} clickedRow - The row last clicked, carrying its position as `ROW_ID`, or undefined.
 * @param {object} selection - Null without multi-select, else `{ selectedKeys, onRowsSelected,
 *   onRowsDeselected }`; the two callbacks receive `[{ rowIdx, row }]`.
 * @param {element} contextMenu - The right-click menu, given the clicked cell's `rowIdx` and `idx`.
 * @param {function} emptyView - The component drawn when there are no rows.
 */
export default class ReactDataGridBody extends React.Component {
  /* One function for the life of the grid, reading the rows as they are when it is called, as the
  one GenericGrid passed before: react-data-grid compares its props to decide what to redraw, and a
  new function on every render would be a change on every render. */
  rowGetter = (i) => this.props.rows[i]

  render() {
    const {
      rows, rowKey, columns, height, minColumnWidth, className, toolbar, onSort, onFilterChange,
      onClearFilters, getFilterOptions, onRowClick, onRowsUpdated, clickedRow, selection, contextMenu,
      emptyView
    } = this.props

    return (
      <ReactDataGrid
        enableCellSelect
        rowKey={rowKey}
        columns={columns}
        rowGetter={this.rowGetter}
        rowsCount={rows.length}
        minHeight={height}
        minColumnWidth={minColumnWidth}
        className={className}
        headerRowHeight={HEADER_ROW_HEIGHT}
        toolbar={toolbar}
        onAddFilter={onFilterChange}
        onClearFilters={onClearFilters}
        onRowClick={onRowClick}
        getValidFilterValues={getFilterOptions}
        onGridRowsUpdated={onRowsUpdated}
        rowRenderer={clickedRow ? customRowRenderer(clickedRow.ROW_ID, clickedRow) : customRowRendererSecondary()}
        rowSelection={selection ? {
          showCheckbox: true,
          enableShiftSelect: true,
          onRowsSelected: selection.onRowsSelected,
          onRowsDeselected: selection.onRowsDeselected,
          selectBy: {
            keys: {
              rowKey,
              values: selection.selectedKeys
            }
          }
        } : null}
        onGridSort={onSort}
        RowsContainer={ContextMenuTrigger}
        contextMenu={contextMenu}
        emptyRowsView={emptyView}
      />
    )
  }
}
