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
 * Represents a instance of a grid. Its data is kept in a reducer identified by this instance's ID parameter (see THE SLICE below).
 *
 * MANDATORY PARAMETERS
 * @param {string} id - Id of this instance of the grid. This id will be used everewhere throughout the system to identify this grid.
 * @param {string} session - The session which this grid instance will use
 * @param {string} configTableName - Parameter which will be used to call the webservice for configuration ( how many fields, what type etc etc) . If gridType is BASE it will try to find configuration for that table in the database. If gridType is CUSTOM then it will call the webservice with that identifier from config.js and use the data from it to fill the configuration
 * @param {string} dataTableName -  Parameter which will be used to call the webservice for data. If gridType is BASE it will try to find data for that table in the database. If gridType is CUSTOM then it will call the webservice with that identifier from config.js and use the data  that it receives to fill the grid
 *
 * OPTIONAL PARAMETERS
 * @param {array} buttonsArray - creates buttons from the array of objects in CustomGridToolbar (max 3 buttons), the array of object must be in this format (note that the functions should be binded), Example:
  [{
    "name": 'name-example',
    "action": () => this.functionX(),
    "id" : "first"
  }, {
    "name": 'name-example-2',
    "action": () => this.functionY(),
    "id" : "second"
  }]
 * @param {boolean} enableMultiSelect -  Enable or disable row selection
 * @param {function} onSelectChangeFunct - Function which will be called when a change in selected rows happen (rowSelection), with the selected rows and the grid's id. See enableMultiSelect.
 * @param {function} addRowSub - Function which will be called when the AddRow button is pressed. No default behaviour
 * @param {function} onRowClickFunct - Function which will be called when a row is clicked, with the grid's id, the row's index as drawn and the row. The clicked row is also published into the rowClicked variable of its own reducer
 * @param {function} handleRowUpdatedFunct - Function which will be called when an edited cell is saved, with the grid's id, the rows as drawn, the index of the edited row among them and the changed values. When it returns a promise, the grid shows its loader until the promise settles. A grid given one does not report row clicks.
 * @param {Number} minWidth - Width of the grid. If null it will take 77% of the parent window.
 * @param {Number} minColumnWidth - Minimum width of the columns (in pixels). If null it will take the default value of 80px
 * @param {Number} minHeight - Height of the grid. If null it will take 70% of the parent window.
 * @param {Boolean} defaultHeight - Cancel pre-set value for height
 * @param {Number} heightRatio - height Ratio
 * @param {string} gridType - Type of grid that needs to be rendered. Can be CUSTOM or null (BASE)
 * @param {Array} params - An array of objects to be replaced during webservice call replacement. The objects inside the array need to be in the following format  :  PARAM_NAME: {nameOfParameter} , PARAM_VALUE : {valueToBeReplaced}. Example usage :
 * @param {String} customToolbarDescription - Toolbar description for grids.
  let params = []
          params.push({
            PARAM_NAME: 'session',
            PARAM_VALUE: this.props.svSession
          }
 * @param {boolean/function} refreshData - true/false default refresh btn top righ toolbar
 *
 * THE SLICE
 * The fetched configuration and data are kept in the grid's reducer (gridConfigLoaded, gridConfig, gridDataLoaded, gridData),
 * and come back to the grid as props. The grid publishes into it what others read:
 *        gridConfig - The columns as the grid draws them, made from the configuration, with their names translated.
 *        rows - The data, with its dates written as the grid shows them.
 *        filters - The filters applied on the rendered grid, by column key.
 *        filteredRows - The rows those filters leave, unsorted, or undefined while no filter has been set.
 *        selectedKeys - The primary key values (PKID) of the selected rows, which persist across sorting and filtering.
 *        selectedRowData - The selected rows.
 *        rowClicked - The row last clicked, with its index as drawn in ROW_ID.
 * Others write into it: rowClicked (undefined clears it), reloadGrid (true fetches the data again, see GridManager.reloadGridData)
 * and selectedKeys and selectedRowData (GridManager.cleanSelection). Any other prop is the grid's to read as it is given.
 * It is mandatory to set gui_metadata params to all fields intended to be sortable, in order to enable the functionality
 * Params used in gui_metadata are =>
 *        sortable=true/false,  - MANDATORY to enable sort for each field, provides a clickable header cell where each sortable field can be sorted by the user, via a toggle cycle of 'ASC/DESC/NONE'
 *        isDefaultSort=true/false,   - sets default column to be sorted on initial render, setting multiple fields per table possible (not advisable)
 *        defaultSortDirection='ASC/DESC' - sets default sort direction on initial render, use together with isDefaultSort, if param is ommited it will revert to DESC
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
      // Adds print col in 0 || 1 position based on menu_conf
      printColumn: printout ? printColumn(printout) : undefined,
      // replace grid headers (element.name) with labels, labels are element.key.toLowerCase()
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
  // const finalWidth = props.minWidth > 0 ? props.minWidth : (window.innerWidth * 0.772)

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
              /* Displays a message and an image inside the grid when no rows are retreived
              The image must be supplied from outside the components package */
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
