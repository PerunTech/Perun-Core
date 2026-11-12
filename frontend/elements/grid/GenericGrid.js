import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import TanStackGridBody from './body/TanStackGridBody';
import { translateComponents } from '../../config/config';
import { store, getGridConfig, getGridData, publishState, rowClicked, resetGridEditResponseState } from '../../model';
import { WrapItUp, ComponentManager, GridManager, alertUser, alertUserResponse, alertUserV2, Icon } from '..';
import { Loading } from '../../components/ComponentsIndex';
import CustomGridToolbar from './chrome/CustomGridToolbar';
import ContextMenuPopup from './chrome/ContextMenuPopup';
import { columnParts, printColumn } from './cells/columnParts';
import { defaultSort, gridColumns } from './logic/columns';
import { filtersApplied, formatDates, getRows, pkidKey, tickRows, untickRows, withFilter } from './logic/rows';
import { label } from './logic/labels';
import { changedSources, sourcesOf } from './logic/sources';
import { isValidArray } from '../../functions/utils';
import { filterOptions } from './logic/codeList';

const NO_FILTERS = []

const NO_ROWS = []

// The columns come back from the slice as the gridConfig prop. Made again from that, they would be
// published again with no end, so each maps back to the config it was made from.
const configOfColumns = new WeakMap()

// A grid mounted under the id of one leaving in the same render takes the slice first, so the old
// one's cleanup must leave it alone or the new grid stays on its loader.
const owners = new Map()

const emptySlice = () => ({
  gridConfigLoaded: undefined, gridConfig: undefined, gridDataLoaded: undefined, gridData: undefined,
  reloadGrid: undefined, inlineSaveResult: undefined, saveAllResult: undefined, rowClicked: undefined,
  rows: undefined, filters: undefined, filteredRows: undefined, selectedKeys: [], selectedRowData: []
})

const NO_SLICE = {}

// On failure the reducer keeps the error where the array would be.
const fetchFailed = (loaded, payload) => loaded === false && Boolean(payload) && payload.constructor !== Array

function gridHeight({ defaultHeight, minHeight, heightRatio }) {
  if (defaultHeight) {
    return undefined
  }
  return minHeight > 0 ? minHeight : window.innerHeight * (heightRatio || 0.8)
}

function refresh(id, refreshData, intl) {
  if (typeof refreshData === 'boolean') {
    GridManager.reloadGridData(id)
  } else if (typeof refreshData === 'function') {
    refreshData()
  } else {
    alertUserV2({ type: 'info', title: label(intl, 'error.refresh_data') })
  }
}

function NoRows({ height }) {
  const intl = useIntl()
  return (
    <div style={{ marginTop: (height / 2) - (height / 10), fontWeight: 'bold' }}>
      {label(intl, 'main.grids.no_data')}
      <br />
      <Icon name='IconBoxOff' />
    </div>
  )
}

// Publishes to its slice gridConfig (the columns as drawn), rows, filters, filteredRows (undefined
// while unfiltered), selectedKeys, selectedRowData and rowClicked (with ROW_ID). Others write
// rowClicked, reloadGrid (GridManager.reloadGridData) and the selection (GridManager.cleanSelection).
// gridType: BASE (table names), CUSTOM (triglavRestVerbs verbs), SEARCH_GRID_DATA (the data itself, or
// a path), else a services path. params replace %PARAM_NAME in a path.
function GenericGrid(props) {
  const {
    id, session, gridType, params, configTableName, dataTableName, printout, enableMultiSelect,
    onRowClickFunct, onSelectChangeFunct, handleRowUpdatedFunct, addRowSub, toggleCustomButton, customButton, refreshData
  } = props
  // The first render may still see the slice a previous grid with this id left.
  const [started, setStarted] = useState(false)
  const {
    gridConfigLoaded, gridConfig, gridDataLoaded, gridData, reloadGrid, inlineSaveResult, rowClicked: clickedRow,
    selectedKeys = NO_ROWS
  } = started ? props : NO_SLICE
  const intl = useIntl()

  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState()
  const [requestPending, setRequestPending] = useState(false)
  const [hideLoader, setHideLoader] = useState(false)
  // Draws the body anew (filter row closed) on each refetch, also when the answer beats the loader.
  const [refetches, setRefetches] = useState(0)
  // This grid, as the owner of its slice.
  const [self] = useState(() => ({}))
  const fetchedFrom = useRef()

  // The latest request per kind. Older answers, or ones for a grid that has gone, are dropped.
  const waiting = useRef({})
  const ask = (kind, request) => {
    const token = {}
    waiting.current[kind] = token
    request((action) => {
      if (waiting.current[kind] === token) {
        store.dispatch(action)
      }
    }, store.getState)
  }

  const config = configOfColumns.get(gridConfig) || gridConfig
  const columns = useMemo(() => {
    if (!isValidArray(config, 1)) {
      return config
    }
    const made = gridColumns(config, {
      parts: columnParts,
      printColumn: printout ? printColumn(printout) : undefined,
      translate: translateComponents ? (key) => label(intl, `grid_labels.${key.toLowerCase()}`) : undefined
    })
    configOfColumns.set(made, config)
    return made
  }, [config, printout, intl])

  const rows = useMemo(() => (gridData && config ? formatDates(config, gridData) : undefined), [gridData, config])

  const rowKey = useMemo(() => pkidKey(rows, configTableName), [rows, configTableName])

  const { sortColumn, sortDirection } = sort || (isValidArray(columns, 1) && defaultSort(columns)) || {}
  const filteredRows = useMemo(() => (Array.isArray(filters) ? undefined : getRows({ rows, filters })), [rows, filters])
  const shownRows = useMemo(
    () => getRows({ rows: filteredRows || rows, sortColumn, sortDirection }),
    [rows, filteredRows, sortColumn, sortDirection]
  )

  // A layout effect, so it runs before the cleanup of a same-id grid leaving in this render.
  useLayoutEffect(() => {
    owners.set(id, self)
    store.dispatch(publishState(id, emptySlice()))
    ask('config', getGridConfig(id, configTableName, session, params, gridType))
    ask('rows', getGridData(id, dataTableName, session, params, gridType))
    fetchedFrom.current = sourcesOf(props)
    setStarted(true)
    // Mount only; the effect below fetches later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    waiting.current = {}
    if (owners.get(id) === self) {
      owners.delete(id)
      ComponentManager.cleanComponentReducerState(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // New config clears the sort and filters; new rows clear the filters, the selection and the clicked
  // row, as mounting again would.
  useEffect(() => {
    const before = fetchedFrom.current
    const now = sourcesOf(props)
    const { config: configChanged, data: rowsChanged } = changedSources(before, now)
    if (!configChanged && !rowsChanged) {
      return
    }
    fetchedFrom.current = now
    setFilters(NO_FILTERS)
    setRefetches((count) => count + 1)
    if (configChanged) {
      setSort(undefined)
      store.dispatch(publishState(id, { gridConfigLoaded: false }))
      ask('config', getGridConfig(id, configTableName, session, params, gridType))
    }
    if (rowsChanged) {
      store.dispatch(publishState(id, { gridDataLoaded: false, rowClicked: undefined, selectedKeys: [], selectedRowData: [] }))
      ask('rows', getGridData(id, dataTableName, session, params, gridType))
    }
    // Compared by value inside, so that a new params array with the same values fetches nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridType, configTableName, dataTableName, params])

  // Compared with what was published last, not the slice: a fetch may have changed the slice since
  // this render, and the fetched config must not be overwritten.
  const published = useRef({})
  useEffect(() => {
    const values = { gridConfig: columns, rows, filters, filteredRows }
    const changed = Object.keys(values).filter((key) => values[key] !== published.current[key])
    published.current = values
    if (changed.length > 0) {
      store.dispatch(publishState(id, Object.fromEntries(changed.map((key) => [key, values[key]]))))
    }
  }, [id, columns, rows, filters, filteredRows])

  // GridManager sets reloadGrid and the data fetch clears it.
  useEffect(() => {
    if (reloadGrid === true && gridDataLoaded === true) {
      setFilters(NO_FILTERS)
      setRefetches((count) => count + 1)
      store.dispatch(publishState(id, { gridDataLoaded: false }))
      ask('rows', getGridData(id, dataTableName, session, params, gridType))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadGrid])

  useEffect(() => {
    if (fetchFailed(gridConfigLoaded, gridConfig)) {
      alertUserResponse({ response: gridConfig.response })
      setHideLoader(true)
    }
  }, [gridConfigLoaded, gridConfig])

  useEffect(() => {
    if (fetchFailed(gridDataLoaded, gridData)) {
      alertUserResponse({ response: gridData.response })
      setHideLoader(true)
    }
  }, [gridDataLoaded, gridData])

  // The reducer sets reloadGrid with the answer, so the saved row comes back with the rest.
  useEffect(() => {
    if (!inlineSaveResult) {
      return
    }
    setRequestPending(false)
    const reset = () => store.dispatch(resetGridEditResponseState(id))
    if (inlineSaveResult.type === 'ERROR' || inlineSaveResult.type === 'EXCEPTION') {
      setHideLoader(true)
      alertUser(true, 'error', inlineSaveResult.title, inlineSaveResult.message, reset, undefined, false, undefined, undefined, false, undefined)
    } else {
      reset()
    }
  }, [id, inlineSaveResult])

  const onSort = useCallback((column, direction) => setSort({ sortColumn: column, sortDirection: direction }), [])
  const onFilterChange = useCallback((filter) => setFilters((current) => withFilter(current, filter)), [])
  const onClearFilters = useCallback(() => setFilters(NO_FILTERS), [])

  const getFilterOptions = useCallback((columnId) => filterOptions(columns, rows, columnId), [columns, rows])

  // Read from the store, so a deselection and a selection from the same click both count.
  const changeSelection = useCallback((selection) => {
    store.dispatch(publishState(id, selection))
    if (onSelectChangeFunct) {
      onSelectChangeFunct(selection.selectedRowData, id)
    }
  }, [id, onSelectChangeFunct])

  const onRowsSelected = useCallback(
    (ticked) => changeSelection(tickRows(store.getState()[id] || {}, ticked, rowKey)),
    [id, rowKey, changeSelection]
  )

  const onRowsDeselected = useCallback(
    (unticked) => changeSelection(untickRows(store.getState()[id] || {}, unticked, rowKey)),
    [id, rowKey, changeSelection]
  )

  // Rows the filters hide included.
  const clearSelection = () => changeSelection({ selectedKeys: [], selectedRowData: [] })

  const onRowClick = useCallback((rowIdx, row) => {
    if (rowIdx > -1 && !handleRowUpdatedFunct) {
      store.dispatch(rowClicked(id, row, rowIdx))
      if (typeof onRowClickFunct === 'function') {
        onRowClickFunct(id, rowIdx, row)
      } else if (onRowClickFunct) {
        console.warn('Cannot invoke onRowClick since it is not a function.')
      }
    }
  }, [id, handleRowUpdatedFunct, onRowClickFunct])

  const handleRowUpdated = useCallback((commit) => {
    if (handleRowUpdatedFunct) {
      const saving = handleRowUpdatedFunct(id, shownRows, commit.fromRow, commit.updated)
      if (saving && typeof saving.then === 'function') {
        setRequestPending(true)
        const done = () => setRequestPending(false)
        saving.then(done, done)
      }
    } else {
      console.warn('No inline grid save function provided. No default function found.')
    }
  }, [id, shownRows, handleRowUpdatedFunct])

  // The modules' functions take no arguments.
  const addRow = () => addRowSub && addRowSub()
  const onCustomButton = () => {
    if (toggleCustomButton && customButton) {
      customButton()
    }
  }

  const rowText = label(intl, selectedKeys.length === 1 ? 'row_selected' : 'rows_selected')
  const finalHeight = gridHeight(props)
  const className = props.className || 'reactGrid'
  const filtered = filtersApplied(filters)
  const ticked = selectedKeys.length

  return (
    <div>
      {(!gridConfigLoaded || !gridDataLoaded || requestPending) && !hideLoader &&
        <div>
          <Loading />
        </div>
      }

      {gridConfigLoaded && gridDataLoaded && columns &&
        <div id={className} className={className}>
          <div id='separateText' className='separator' />
          <TanStackGridBody
            key={refetches}
            rows={shownRows}
            rowKey={rowKey}
            columns={columns}
            height={finalHeight}
            minColumnWidth={props.minColumnWidth}
            toolbar={
              <CustomGridToolbar
                enableFilter
                hasLinkGridInModal={props.hasLinkGridInModal}
                {...props.buttonsArray && { buttonsArray: props.buttonsArray }}
                {...toggleCustomButton && { customButtonLabel: props.customButtonLabel }}
                {...toggleCustomButton && { additionalButtonLabel: props.additionalButtonLabel }}
                {...toggleCustomButton && { additionalButton: props.additionalButton }}
                {...toggleCustomButton && { customButton: onCustomButton }}
                {...addRowSub && { onAddRow: addRow }}
                {...toggleCustomButton && { customButtonClassName: props.customButtonClassName }}
                {...toggleCustomButton && { additionalButtonClassName: props.additionalButtonClassName }}
                {...toggleCustomButton && { customButtonTitle: props.customButtonTitle }}
                addRowButtonText={label(intl, 'main.grids.add')}
                filterRowsButtonText={label(intl, 'main.grids.search')}
              >
                {refreshData && (
                  <div className='refresh-data-container'>
                    <span id='refreshData' className='refreshData' onClick={() => refresh(id, refreshData, intl)}>
                      {<Icon name='IconRefresh' />}
                    </span>
                  </div>
                )}
                <div className='rowcount-container'>
                  <span id={filtered ? 'reactGridspan1' : 'reactGridspan2'}>
                    {label(intl, 'main.grids.rowcount')} <span className='rowcount-value'>{shownRows.length}</span>
                    {filtered && ` ${label(intl, 'main.grids.rowcount_of')} ${rows.length}`}
                  </span>
                </div>
                {enableMultiSelect === true && ticked > 0 && (
                  <div className='selected-rows-container perun-grid-selection'>
                    <Icon name='IconChecks' size={16} />
                    <span id='reactGridspan3'><span className='rowcount-value'>{ticked}</span> {rowText}</span>
                    <button type='button' className='perun-grid-clear' data-action='clear-selection' onClick={clearSelection}>
                      <Icon name='IconX' size={14} />
                      {label(intl, 'main.grids.clear_selection')}
                    </button>
                  </div>
                )}
                {props.customToolbarDescription && (
                  <div className='custom-toolbar-description'>
                    <p className='custom-toolbar-msg'>{props.customToolbarDescription}</p>
                  </div>
                )}
              </CustomGridToolbar>
            }
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
            filters={filters}
            onFilterChange={onFilterChange}
            onClearFilters={onClearFilters}
            getFilterOptions={getFilterOptions}
            onRowClick={onRowClick}
            onRowsUpdated={handleRowUpdated}
            clickedRow={clickedRow || undefined}
            selection={enableMultiSelect === true ? {
              selectedKeys,
              onRowsSelected,
              onRowsDeselected
            } : null}
            contextMenu={<ContextMenuPopup
              // As drawn: the body hands the menu the row's position on screen.
              rows={shownRows}
              id={id}
              enableMultiSelect={enableMultiSelect}
              gridConfig={columns}
              editContextFunc={props.editContextFunc} />
            }
            emptyView={<NoRows height={finalHeight} />}
          />
        </div>
      }
    </div>
  )
}

export default WrapItUp(GenericGrid, 'GenericGrid', undefined, true)
