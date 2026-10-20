import React from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { labelBasePath } from '../../../config';
import { Icon } from '../..';
import TextFilter from '../cells/TextFilter';
import { LAYOUT } from './layout';

/* What the TanStack body draws, part by part: a row and its cells, a header cell, a cell of the
filter row, and the view shown when the filters leave out every row. TanStackGridBody's JSDoc lists
the attributes they carry. */

const SORT_ICONS = { ASC: 'IconArrowUp', DESC: 'IconArrowDown' }
const ARIA_SORT = { ASC: 'ascending', DESC: 'descending' }

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

/* A cell with a column's value. Drawn again only when its row, its width or whether it is the
active cell changes, so that a step of a resize draws the cells of the column being dragged and
leaves the others as they are. A code list cell carries its value as it is stored, not as shown, so
that the deployment can colour it by its value. */
const GridCell = React.memo(function GridCell({ cell, width, row, rowIdx, active, type }) {
  const value = row[cell.column.key]
  return (
    <div
      role='gridcell'
      data-column-key={cell.id}
      data-idx={cell.idx}
      data-active={active ? 'true' : undefined}
      data-type={type}
      data-value={type === 'code' && value !== null && value !== undefined && value !== '' ? String(value) : undefined}
      className={classNames('perun-grid-cell', { 'perun-grid-cell--active': active }, cell.column.cellClass)}
      style={{ ...LAYOUT.cell, width }}
    >
      {cellContent(cell.column, row, rowIdx)}
    </div>
  )
})

/* A row's multi-select box. A click here ticks the box and is not a click on the row, as in
react-data-grid. */
const SelectCell = React.memo(function SelectCell({ cell, width, rowIdx, selected, active, tableRow, onSelectCell }) {
  return (
    <div
      role='gridcell'
      data-part='select'
      data-idx={cell.idx}
      data-active={active ? 'true' : undefined}
      className={classNames('perun-grid-cell perun-grid-cell--select', { 'perun-grid-cell--active': active })}
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
widths, but within each only the cells whose width changed are drawn again. `activeIdx` is the
position of the active cell when it is in this row, else -1, so that moving it draws only the
two rows it leaves and enters. `types` are the columns' types (see columnType in logic/columns.js),
by position. */
export const GridRow = React.memo(function GridRow({
  row, rowIdx, rowId, ariaRowIndex, top, cells, widths, types, selected, clicked, activeIdx, tableRow, onSelectCell
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
        <GridCell
          key={cell.id}
          cell={cell}
          width={widths[cell.idx]}
          row={row}
          rowIdx={rowIdx}
          active={activeIdx === cell.idx}
          type={types[cell.idx]}
        />
      ) : (
        <SelectCell
          key={cell.id}
          cell={cell}
          width={widths[cell.idx]}
          rowIdx={rowIdx}
          selected={selected}
          active={activeIdx === cell.idx}
          tableRow={tableRow}
          onSelectCell={onSelectCell}
        />
      )))}
    </div>
  )
})

/* A column's header cell: its name, the sort control when it sorts, and the resize handle when it
resizes. Drawn again only when its width, its sort, its resizing state, its column's type or whether
a filter is applied to it changes. */
export const HeaderCell = React.memo(function HeaderCell({ cell, width, header, direction, resizing, type, filtered, onSort }) {
  const { column } = cell
  return (
    <div
      role='columnheader'
      data-column-key={cell.id}
      data-type={type}
      data-filtered={filtered ? 'true' : undefined}
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
export const FilterCell = React.memo(function FilterCell({ cell, width, onFilterChange, getFilterOptions }) {
  const Filter = cell.column && cell.column.filterable ? cell.column.filterRenderer || TextFilter : null
  return (
    <div role='gridcell' data-column-key={cell.id} className='perun-grid-filter-cell' style={{ ...LAYOUT.filterCell, width }}>
      {Filter && <Filter column={cell.column} onChange={onFilterChange} getValidFilterValues={getFilterOptions} />}
    </div>
  )
})

/* What the grid shows when its filters leave out every row: that they did, and a button that clears
them. */
export function NoMatchView({ onClearFilters }) {
  const intl = useIntl()
  const label = (code) => intl.formatMessage({ id: `${labelBasePath}.main.grids.${code}`, defaultMessage: `${labelBasePath}.main.grids.${code}` })
  return (
    <>
      <Icon name='IconFilterOff' />
      <div className='perun-grid-message'>{label('no_match')}</div>
      <button type='button' className='perun-grid-clear' data-action='clear-filters' onClick={onClearFilters}>
        <Icon name='IconFilterX' size={16} />
        {label('clear_filters')}
      </button>
    </>
  )
}
