import React from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { labelBasePath } from '../../../config';
import { Icon } from '../..';
import TextFilter from '../cells/TextFilter';
import { LAYOUT } from './layout';

const SORT_ICONS = { ASC: 'IconArrowUp', DESC: 'IconArrowDown' }
const ARIA_SORT = { ASC: 'ascending', DESC: 'descending' }

// <wbr> after each underscore, so WORKFLOW_ITEM_NAME wraps between its words without changing its text.
function headerName(name) {
  if (typeof name !== 'string' || !name.includes('_')) {
    return name
  }
  const parts = name.split('_')
  return parts.map((part, i) => (i < parts.length - 1
    ? <React.Fragment key={i}>{part}_<wbr /></React.Fragment>
    : part))
}

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

// Memoized, so a resize step draws only the dragged column's cells. A code list cell carries its
// stored value for the deployment to colour by.
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

// A click here ticks the box and is not a row click.
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

// Memoized: scrolling keeps a row's props, and activeIdx is -1 unless the active cell is in this row,
// so moving it draws only the two rows it leaves and enters.
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

export const FilterCell = React.memo(function FilterCell({ cell, width, onFilterChange, getFilterOptions }) {
  const Filter = cell.column && cell.column.filterable ? cell.column.filterRenderer || TextFilter : null
  return (
    <div role='gridcell' data-column-key={cell.id} className='perun-grid-filter-cell' style={{ ...LAYOUT.filterCell, width }}>
      {Filter && <Filter column={cell.column} onChange={onFilterChange} getValidFilterValues={getFilterOptions} />}
    </div>
  )
})

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
