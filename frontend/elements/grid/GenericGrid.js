import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import TanStackGridBody from './body/TanStackGridBody';
// react-select's sheet, for every Select in the bundle (GenericForm's, DirectAccess', the filter
// row's, and the one exported to the modules), which react-data-grid-addons used to insert.
import 'react-select/dist/react-select.css';
import { labelBasePath, translateComponents } from '../../config/config';
import { store, getGridConfig, getGridData, publishState, rowClicked, resetGridEditResponseState } from '../../model';
import { WrapItUp, ComponentManager, alertUser, alertUserResponse, alertUserV2, Icon } from '..';
import { Loading } from '../../components/ComponentsIndex';
import CustomGridToolbar from './chrome/CustomGridToolbar';
import ContextMenuPopup from './chrome/ContextMenuPopup';
import { columnParts, printColumn } from './cells/columnParts';
import { defaultSort, gridColumns } from './logic/columns';
import { filtersApplied, formatDates, getRows, withFilter } from './logic/rows';
import { GridManager } from '..';
import { isValidArray } from '../../functions/utils';
import { filterOptions } from './logic/codeList';

/* The filters a grid starts with, and goes back to when they are cleared or its rows fetched again. */
const NO_FILTERS = []

/* The selection of a grid whose slice holds none yet. */
const NO_ROWS = []

/* The config each grid's columns were made from. The columns are published as the slice's
gridConfig and come back as the grid's gridConfig prop, where they stand for that config: made again
from themselves, they would be published again and come back again, with no end. */
const configOfColumns = new WeakMap()

/**
 * A table's rows, with its columns, both fetched from the backend (see `gridType`), drawn by
 * TanStackGridBody under CustomGridToolbar. ExportableGrid adds the export buttons below it; modules
 * render that rather than this.
 *
 * Each grid has a Redux slice named by its `id`, which WrapItUp makes and spreads over its props. The
 * reducer keeps what was fetched there (gridConfigLoaded, gridConfig, gridDataLoaded, gridData), and
 * the grid publishes there what others read: `gridConfig`, the columns as drawn, made from the config
 * with their names translated; `rows`, the fetched rows with their dates as shown; `filters`, by
 * column key; `filteredRows`, the rows the filters leave, unsorted, or undefined while no filter has
 * been set; `selectedKeys` and `selectedRowData`, the ticked rows' PKIDs and the rows; and
 * `rowClicked`, the row last clicked, with its position as drawn in `ROW_ID`. Others write
 * `rowClicked` (undefined clears it), `reloadGrid` (true fetches the rows again, see
 * GridManager.reloadGridData) and the selection (GridManager.cleanSelection). The config is fetched
 * once, when the grid mounts.
 *
 * The columns are made from the table's GUI metadata (see logic/columns.js and cells/columnParts.js).
 * A `sortable` column is sorted by a click on its header, ascending, descending, then not at all, or
 * descending first with `sortDescendingFirst`. Until a header is clicked the rows are sorted by the
 * column marked `isDefaultSort` (the last one, if several are), in its `defaultSortDirection`, `ASC`
 * or `DESC` (the default).
 *
 * @param {string} id - The grid's id: its slice's name, and the first argument its callbacks get.
 * @param {string} gridType - How `configTableName` and `dataTableName` are read: `BASE`, as a table's
 *   name, through the BASE and BASE_DATA verbs; `CUSTOM`, as the name of a verb in
 *   svConfig.triglavRestVerbs; `SEARCH_GRID_DATA`, as the config and the rows themselves, or as a path
 *   when a string; anything else (`READ_URL`, or none), as a path on the backend's services.
 * @param {string|Array} configTableName - Where the column config comes from (see gridType).
 * @param {string|Array} dataTableName - Where the rows come from (see gridType).
 * @param {Array} params - `{ PARAM_NAME, PARAM_VALUE }` objects: `%PARAM_NAME` in a path is replaced by
 *   its PARAM_VALUE. `%session` is the session and `%gridName` the table's name or path.
 * @param {string} session - Set by WrapItUp, from the store's session.
 * @param {boolean} enableMultiSelect - True for a tick box in front of each row.
 * @param {function} onSelectChangeFunct - `(selectedRows, id)`, when the ticked rows change.
 * @param {function} onRowClickFunct - `(id, rowIdx, row)`, when a row is clicked; `rowIdx` is its
 *   position as drawn.
 * @param {function} handleRowUpdatedFunct - `(id, rows, rowIdx, updated)`, when an edited cell is
 *   saved: the rows as drawn, the edited row's position among them and the changed values. While a
 *   promise it returns is pending, the grid shows its loader. A grid given one reports no row clicks.
 * @param {function} editContextFunc - `(id, rowIdx, row)`: adds Edit row to the context menu.
 * @param {string} printout - Adds a column of print buttons in front of the others: the URL they
 *   open, with `{rowObjectId}` where the row's object id goes.
 * @param {function} addRowSub - Adds the toolbar's Add button, which calls it.
 * @param {Array} buttonsArray - Buttons for the toolbar, `{ id, name, action, className }` each.
 * @param {boolean} toggleCustomButton - Shows `customButton` and `additionalButton`; without it,
 *   they and the props below that go with them are left out.
 * @param {function} customButton - A toolbar button that calls it, labelled `customButtonLabel`, with
 *   the class `customButtonClassName` and the tooltip `customButtonTitle`.
 * @param {function} additionalButton - Another, labelled by the label code `additionalButtonLabel`,
 *   with the class `additionalButtonClassName`.
 * @param {boolean} hasLinkGridInModal - Labels those two buttons Find existing rather than Add when
 *   they are given no label.
 * @param {boolean|function} refreshData - Adds a refresh button: true fetches the rows again, a
 *   function is called instead.
 * @param {string} customToolbarDescription - Text shown in the toolbar.
 * @param {number} minHeight - The grid's height in pixels; without it, the window's height times
 *   `heightRatio` (0.8 unless given). `defaultHeight` leaves it to TanStackGridBody (350).
 * @param {number} minColumnWidth - The narrowest a column may be, in pixels (80 unless given).
 * @param {number} minWidth - Not used: the columns share the width of the grid's box.
 * @param {string} className - The id and class of the grid's box, `reactGrid` unless given.
 */
function GenericGrid(props) {
  const {
    id, session, gridType, params, configTableName, dataTableName, gridConfigLoaded, gridConfig, gridDataLoaded, gridData,
    reloadGrid, inlineSaveResult, rowClicked: clickedRow, selectedKeys = NO_ROWS, printout, enableMultiSelect,
    onRowClickFunct, onSelectChangeFunct, handleRowUpdatedFunct, addRowSub, toggleCustomButton, customButton, refreshData
  } = props
  const intl = useIntl()
  const label = (code) => intl.formatMessage({ id: `${labelBasePath}.${code}`, defaultMessage: `${labelBasePath}.${code}` })

  const [filters, setFilters] = useState(NO_FILTERS)
  // The sort picked from a header, undefined until one is.
  const [sort, setSort] = useState()
  const [requestPending, setRequestPending] = useState(false)
  const [hideLoader, setHideLoader] = useState(false)

  const config = configOfColumns.get(gridConfig) || gridConfig
  const columns = useMemo(() => {
    if (!isValidArray(config, 1)) {
      return config
    }
    const made = gridColumns(config, {
      parts: columnParts,
      printColumn: printout ? printColumn(printout) : undefined,
      // A column's name is the label grid_labels.<its key, in lower case>.
      translate: translateComponents ? (key) => intl.formatMessage({
        id: `${labelBasePath}.grid_labels.${key.toLowerCase()}`,
        defaultMessage: `${labelBasePath}.grid_labels.${key.toLowerCase()}`
      }) : undefined
    })
    configOfColumns.set(made, config)
    return made
  }, [config, printout, intl])

  // The fetched rows with their dates written as the grid shows them, once per fetch.
  const rows = useMemo(() => (gridData && config ? formatDates(config, gridData) : undefined), [gridData, config])

  // The key holding each row's PKID, as the rows have it: its prefix may differ from configTableName.
  const rowKey = useMemo(
    () => (isValidArray(rows, 1) && Object.keys(rows[0]).find((key) => key.endsWith('.PKID'))) || `${configTableName}.PKID`,
    [rows, configTableName]
  )

  const { sortColumn, sortDirection } = sort || (isValidArray(columns, 1) && defaultSort(columns)) || {}
  const filteredRows = useMemo(() => (Array.isArray(filters) ? undefined : getRows({ rows, filters })), [rows, filters])
  // The rows as drawn: filtered, then sorted.
  const shownRows = useMemo(
    () => getRows({ rows: filteredRows || rows, sortColumn, sortDirection }),
    [rows, filteredRows, sortColumn, sortDirection]
  )

  useEffect(() => {
    store.dispatch(getGridConfig(id, configTableName, session, params, gridType))
    if (!gridDataLoaded) {
      store.dispatch(getGridData(id, dataTableName, session, params, gridType))
    }
    ComponentManager.setStateForComponent(id, null, { selectedKeys: [], selectedRowData: [] })
    return () => ComponentManager.cleanComponentReducerState(id)
    // Fetched once, for the grid as it was mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* The columns, rows and filters are published when they change, compared with what was published
  last rather than with the slice: a fetch may have changed the slice since this render, and the
  fetched config must not be overwritten by the columns made before it came. */
  const published = useRef({})
  useEffect(() => {
    const values = { gridConfig: columns, rows, filters, filteredRows }
    const changed = Object.keys(values).filter((key) => values[key] !== published.current[key])
    published.current = values
    if (changed.length > 0) {
      store.dispatch(publishState(id, Object.fromEntries(changed.map((key) => [key, values[key]]))))
    }
  }, [id, columns, rows, filters, filteredRows])

  /* reloadGrid is set by GridManager and cleared by the data's fetch. The data is fetched again, with
  the filters cleared, when it is set on a grid that has its data. */
  useEffect(() => {
    if (reloadGrid === true && gridDataLoaded === true) {
      setFilters(NO_FILTERS)
      store.dispatch(publishState(id, { gridDataLoaded: false }))
      store.dispatch(getGridData(id, dataTableName, session, params, gridType))
    }
    // Only a change of reloadGrid asks for the data again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadGrid])

  useEffect(() => {
    if (gridConfigLoaded === false && gridConfig && gridConfig.constructor !== Array) {
      alertUserResponse({ response: gridConfig.response })
      setHideLoader(true)
    }
  }, [gridConfigLoaded, gridConfig])

  useEffect(() => {
    if (gridDataLoaded === false && gridData && gridData.constructor !== Array) {
      alertUserResponse({ response: gridData.response })
      setHideLoader(true)
    }
  }, [gridDataLoaded, gridData])

  /* The answer to an edit saved through editRecordInline. The reducer sets reloadGrid along with it,
  so the rows are fetched again, the saved one with them. */
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

  // The values offered in a column's filter dropdown (see filterOptions).
  const getFilterOptions = useCallback((columnId) => filterOptions(columns, rows, columnId), [columns, rows])

  /* The selection is the slice's, which GridManager.cleanSelection clears. It is read from the store,
  so that a deselection and a selection reported by the same click both count. */
  const changeSelection = useCallback((keys, rowData) => {
    store.dispatch(publishState(id, { selectedKeys: keys, selectedRowData: rowData }))
    if (onSelectChangeFunct) {
      onSelectChangeFunct(rowData, id)
    }
  }, [id, onSelectChangeFunct])

  const onRowsSelected = useCallback((selected) => {
    const { selectedKeys: keys = NO_ROWS, selectedRowData: rowData = NO_ROWS } = store.getState()[id] || {}
    changeSelection([...keys, ...selected.map((r) => r.row[rowKey])], [...rowData, ...selected.map((r) => r.row)])
  }, [id, rowKey, changeSelection])

  const onRowsDeselected = useCallback((deselected) => {
    const { selectedKeys: keys = NO_ROWS, selectedRowData: rowData = NO_ROWS } = store.getState()[id] || {}
    const removedKeys = new Set(deselected.map((r) => r.row[rowKey]))
    changeSelection(keys.filter((k) => !removedKeys.has(k)), rowData.filter((r) => !removedKeys.has(r[rowKey])))
  }, [id, rowKey, changeSelection])

  // Unticks every row, those the filters hide included, as unticking them one by one would.
  const clearSelection = () => changeSelection([], [])

  const onRowClick = useCallback((rowIdx, row) => {
    if (rowIdx > -1 && !handleRowUpdatedFunct) {
      store.dispatch(rowClicked(id, row, rowIdx))
      if (onRowClickFunct && (typeof onRowClickFunct === 'function')) {
        onRowClickFunct(id, rowIdx, row)
      } else if (onRowClickFunct && !(typeof onRowClickFunct === 'function')) {
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

  // The toolbar builds its buttons again only when it is given another function for them.
  const addRow = useCallback(() => addRowSub && addRowSub(), [addRowSub])
  const onCustomButton = useCallback(() => {
    if (toggleCustomButton && customButton) {
      customButton()
    }
  }, [toggleCustomButton, customButton])

  const onRefreshData = () => {
    if (typeof refreshData === 'boolean') {
      GridManager.reloadGridData(id)
    } else {
      if (typeof refreshData === 'function') {
        refreshData()
      } else {
        alertUserV2({ type: 'info', title: label('error.refresh_data') })
      }
    }
  }

  const rowText = selectedKeys.length === 1 ? label('row_selected') : label('rows_selected')

  let finalHeight
  if (!props.defaultHeight) {
    finalHeight = props.minHeight > 0 ? props.minHeight : (window.innerHeight * (props.heightRatio || 0.8))
  }

  const imgHeight = finalHeight / 10
  const margin = (finalHeight / 2) - imgHeight

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
                addRowButtonText={label('main.grids.add')}
                filterRowsButtonText={label('main.grids.search')}
              >
                {refreshData && (
                  <div className='refresh-data-container'>
                    <span id='refreshData' className='refreshData' onClick={onRefreshData}>
                      {<Icon name='IconRefresh' />}
                    </span>
                  </div>
                )}
                {/* The rows shown, and out of how many while a filter leaves some out; in a multi-select
                grid, while rows are ticked, how many, with a button that unticks them all. */}
                <div className='rowcount-container'>
                  <span id={filtered ? 'reactGridspan1' : 'reactGridspan2'}>
                    {label('main.grids.rowcount')} <span className='rowcount-value'>{shownRows.length}</span>
                    {filtered && ` ${label('main.grids.rowcount_of')} ${rows.length}`}
                  </span>
                </div>
                {enableMultiSelect === true && ticked > 0 && (
                  <div className='selected-rows-container perun-grid-selection'>
                    <Icon name='IconChecks' size={16} />
                    <span id='reactGridspan3'><span className='rowcount-value'>{ticked}</span> {rowText}</span>
                    <button type='button' className='perun-grid-clear' data-action='clear-selection' onClick={clearSelection}>
                      <Icon name='IconX' size={14} />
                      {label('main.grids.clear_selection')}
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
              // The rows as drawn, sorted as well as filtered: the body hands the menu the
              // position of the row on screen, and the menu reads the row at that position here.
              rows={shownRows}
              id={id}
              enableMultiSelect={enableMultiSelect}
              gridConfig={columns}
              editContextFunc={props.editContextFunc} />
            }
            emptyView={
              <div style={{ 'marginTop': margin, 'fontWeight': 'bold' }}>
                {label('main.grids.no_data')}
                <br />
                {<Icon name='IconBoxOff' />}
              </div>
            }
          />
        </div>
      }
    </div>
  )
}

export default WrapItUp(GenericGrid, 'GenericGrid', undefined, true)
