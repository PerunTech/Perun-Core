import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import ReactDataGrid from 'react-data-grid';
// react-select's sheet, for every Select in the bundle (GenericForm's, DirectAccess', the filter
// row's, and the one exported to the modules), which react-data-grid-addons used to insert. Here,
// after react-data-grid, where the addons put it: react-data-grid's own sheet styles a focused
// Select in the filter row with rules as specific as react-select's, and react-select's won.
import 'react-select/dist/react-select.css';
import './grid.css';
import { labelBasePath, translateComponents } from '../../config/config';
import { store, getGridConfig, getGridData, rowClicked, resetGridEditResponseState } from '../../model';
import { WrapItUp, ComponentManager, alertUser, alertUserResponse, alertUserV2, Icon } from '..';
import { Loading } from '../../components/ComponentsIndex';
import CustomGridToolbar from './CustomGridToolbar';
import ContextMenuPopup from './ContextMenuPopup';
import { ContextMenuTrigger } from './ContextMenu';
import AutoCompleteFilter from './AutoCompleteFilter';
import AutoCompleteEditor from './AutoCompleteEditor';
import DropDownEditor from './DropDownEditor';
import DropDownFormatter from './DropDownFormatter';
import { createRowsSelector, getRows } from './gridRows';
import { customRowRenderer } from './RowRenderer';
import { customRowRendererSecondary } from './RowRendererSecondary';
import PrintButtonFormatter from './PrintButtonFormatter';
import { GridManager } from '..';
import { isValidArray } from '../../functions/utils';
import { cellCodeListValues, codeListText } from './codeListValues';

const PRINT_COLUMN_KEY = '__printout_action__'

/**
 * Represents a instance of a grid. All data from this instance is published in a reducer identified by this instance's ID parameter.
 */
class GenericGrid extends React.Component {
  /**
 * Default constructor.
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
 * @param {function} onSelectChangeFunct - Function which will be called when a change in selected rows happen (rowSelection). See enableMultiSelect.
 * @param {function} addRowSubgrid - Function which will be called when the AddRow button is pressed. No default behaviour
 * @param {function} onRowClickFunct - Function which will be called when a row is clicked. The default behaviour onClick is to publish the row which was clicked into the rowClicked        variable of its own reducer
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
 * INTERNAL VARIABLES
 * @param {Boolean} gridConfigLoaded - Has the grid configuration been Loaded. Grid rendering directly depends on this variable.
 * @param {JSON} gridConfig - The grid configuration. Internal variable that keeps the whole grid configuration and uses it to render the grid. Loaded from webservice. See  configTableName.
 * @param {Boolean} gridDataLoaded -  Has the grid data been Loaded. Grid rendering directly depends on this variable.
 * @param {JSON} gridData - The grid data. Internal variable that keeps the whole grid data and uses it to render the grid. Loaded from webservice. See  dataTableName.
 * @param {Array} selectedKeys - Internal variable that keeps the primary key values (PKID) of the selected rows. Used for key-based selection that persists across sorting and filtering.
 * @param {Array} selectedRowData - Internal variable that keeps the full row data objects of the selected rows.
 * @param {Array} filters - Internal variable that keeps the filters applied on the rendered grid.
 * @param {JSON} rows - Internal variable that keeps the filters applied on the rendered grid. Is assigned from gridData
 * @param {string} rowKey - Internal variable to know which field represents the unique id for a row.
 * It is mandatory to set gui_metadata params to all fields intended to be sortable, in order to enable the functionality
 * Params used in gui_metadata are =>
 *        sortable=true/false,  - MANDATORY to enable sort for each field, provides a clickable header cell where each sortable field can be sorted by the user, via a toggle cycle of 'ASC/DESC/NONE'
 *        isDefaultSort=true/false,   - sets default column to be sorted on initial render, setting multiple fields per table possible (not advisable)
 *        defaultSortDirection='ASC/DESC' - sets default sort direction on initial render, use together with isDefaultSort, if param is ommited it will revert to DESC
 * @param {string} sortColumn - Internal variable to set which field to sort, matches field by internal column name
 * @param {string} sortDirection - Internal variable to know direction of sorted column, used in conjuction with sortColumn
 * @param {boolean/function} refreshData - true/false default refresh btn top righ toolbar
 */
  constructor(props) {
    super(props)
    this.state = {
      addRowSubgrid: this.props.addRowSub,
      customButton: this.props.customButton,
      customButtonLabel: this.props.customButtonLabel,
      toggleCustomButton: this.props.toggleCustomButton,
      hasLinkGridInModal: this.props.hasLinkGridInModal,
      onRowClickFunct: this.props.onRowClickFunct,
      onSelectChangeFunct: this.props.onSelectChangeFunct,
      handleRowUpdatedFunct: this.props.handleRowUpdatedFunct,
      id: this.props.id,
      params: this.props.params,
      gridType: this.props.gridType,
      configTableName: this.props.configTableName,
      dataTableName: this.props.dataTableName,
      enableMultiSelect: this.props.enableMultiSelect,
      minWidth: this.props.minWidth,
      minColumnWidth: this.props.minColumnWidth,
      minHeight: this.props.minHeight,
      gridConfigLoaded: this.props.gridConfigLoaded,
      gridConfig: this.props.gridConfig,
      gridDataLoaded: this.props.gridDataLoaded,
      gridData: this.props.gridData,
      selectedKeys: [],
      selectedRowData: [],
      filters: [],
      rows: this.props.gridData,
      session: this.props.session,
      rowKey: `${this.props.configTableName}.PKID`,
      alert: undefined,
      requestPending: false,
      active: true,
      hideLoader: false,
      buttonsArray: this.props.buttonsArray,
      additionalButton: this.props.additionalButton,
      additionalButtonLabel: this.props.additionalButtonLabel,
      customButtonClassName: this.props.customButtonClassName,
      customButtonTitle: this.props.customButtonTitle,
      className: this.props.className,
      additionalButtonClassName: this.props.additionalButtonClassName,
      refreshData: this.props.refreshData,
    }

    this.selectRows = createRowsSelector()
    this.rowGetter = this.rowGetter.bind(this)
    this.onRowsSelected = this.onRowsSelected.bind(this)
    this.onRowsDeselected = this.onRowsDeselected.bind(this)
    this.onClearFilters = this.onClearFilters.bind(this)
    this.handleFilterChange = this.handleFilterChange.bind(this)
    this.getRows = this.getRows.bind(this)
    this.getSize = this.getSize.bind(this)
    this.onRowClick = this.onRowClick.bind(this)
    this.generateEditorFromConfig = this.generateEditorFromConfig.bind(this)
    this.generateFormatterFromConfig = this.generateFormatterFromConfig.bind(this)
    this.handleRowUpdated = this.handleRowUpdated.bind(this)
    this.onSelectedRowsChange = this.onSelectedRowsChange.bind(this)
    this.getGridConfig = this.getGridConfig.bind(this)
    this.getGridData = this.getGridData.bind(this)
    this.getValidFilterValues = this.getValidFilterValues.bind(this)
    this.addRow = this.addRow.bind(this)
    this.columnValueContainsSearchTerms = this.columnValueContainsSearchTerms.bind(this)
    this.filterValues = this.filterValues.bind(this)
    this.handleGridSort = this.handleGridSort.bind(this)
  }
  /**
  * Internal function to generate a new Editor for fields that have the appropriate configuration.
  */
  generateEditorFromConfig(editorConfig) {
    let retval = null
    const editorType = editorConfig.editorType
    const editorOptions = editorConfig.editorOptions

    switch (editorType) {
      case 'DropDownEditor':
        if (editorOptions !== null && editorOptions !== undefined && editorConfig.editable) {
          retval = <DropDownEditor options={editorOptions} />
        } else if (editorOptions === null || editorOptions === undefined) {
          console.warn('No configuration provided')
        }
        break
      case 'AutoCompleteEditor':
        if (editorOptions !== null && editorOptions !== undefined) {
          retval = <AutoCompleteEditor options={editorOptions} />
        } else {
          console.warn('No configuration provided')
        }
        break
      default:
        retval = null
    }

    return retval
  }
  /**
 * Internal function to generate a new Formatter for fields that have the appropriate configuration.
 */
  generateFormatterFromConfig(editorConfig) {
    let retval = null
    const editorType = editorConfig.formatterType
    const editorOptions = editorConfig.formatterOptions

    switch (editorType) {
      case 'DropDownFormatter':
        if (editorOptions !== null && editorOptions !== undefined) {
          retval = <DropDownFormatter value='' options={editorOptions} />
        }
        break
      default:
        retval = null
    }

    return retval
  }

  /**
   * Convert dates from string into javascript short date format
   * @param {JSON} gridConfig - the grid configuration object
   * @param {JSON} gridData - grid data object
   */
  formatDates(gridConfig, gridData) {
    for (let c = 0; c < gridConfig.length; c++) {
      if (gridConfig[c].datetype) {
        for (let d = 0; d < gridData.length; d++) {
          if (gridData[d][gridConfig[c].key]) {
            const oldDate = gridData[d][gridConfig[c].key]
            // cast the date string as javascript full date format (object)
            if (oldDate.indexOf('T') > -1 && oldDate.indexOf('+') > -1) {
              const date = new Date(oldDate)
              if (gridConfig[c].datetype === 'shortdate') {
                let year = date.getFullYear()
                let month = date.getMonth() + 1
                let day = date.getDate()
                if (day < 10) {
                  day = '0' + day
                }
                if (month < 10) {
                  month = '0' + month
                }
                if (day && month && year) {
                  const newDate = `${day}/${month}/${year}`
                  gridData[d][gridConfig[c].key] = newDate
                }
              } else if (gridConfig[c].datetype === 'longdate') {
                let year = date.getFullYear()
                let month = date.getMonth() + 1
                let day = date.getDate()
                let hours = date.getHours()
                let minutes = date.getMinutes()
                let seconds = date.getSeconds()
                if (day < 10) {
                  day = '0' + day
                }
                if (month < 10) {
                  month = '0' + month
                }
                if (hours < 10) {
                  hours = '0' + hours
                }
                if (minutes < 10) {
                  minutes = '0' + minutes
                }
                if (seconds < 10) {
                  seconds = '0' + seconds
                }
                if (day && month && year && hours && minutes && seconds) {
                  const newDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
                  gridData[d][gridConfig[c].key] = newDate
                }
              }
            }
          }
        }
      }
    }
    let formattedData = gridData
    return formattedData
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    for (const key in nextProps) {
      const value = nextProps[key]
      this.setState({ [key]: value })
    }
    const currGrid = nextProps.gridConfig
    if (currGrid != null && isValidArray(currGrid, 1)) {
      for (let i = 0; i < currGrid.length; i++) {
        const elementstatus = currGrid[i]
        const editorData = this.generateEditorFromConfig(elementstatus)
        const formatterData = this.generateFormatterFromConfig(elementstatus)
        if (editorData !== null && editorData !== undefined) { elementstatus.editor = editorData }
        if (formatterData !== null && formatterData !== undefined) {
          elementstatus.formatter = formatterData
          const filterRendered = AutoCompleteFilter
          elementstatus.filterRenderer = filterRendered
        }
        if (elementstatus.isDefaultSort && (this.state.sortColumn === undefined && this.state.sortDirection === undefined)) {
          this.setState({ sortColumn: elementstatus.key, sortDirection: elementstatus.defaultSortDirection ? elementstatus.defaultSortDirection : 'DESC' })
        }
      }
      // replace grid headers (element.name) with labels, labels are element.key.toLowerCase()
      translateComponents && currGrid && currGrid.map((element) => {
        // enable to easily copy from chrome dev console, i.e copy(temp1)
        // return [`${labelBasePath}.grid_labels.${element.key.toLowerCase()}=${element.name}`]
        element.name = this.context.intl.formatMessage({
          id: `${labelBasePath}.grid_labels.${element.key.toLowerCase()}`,
          defaultMessage: `${labelBasePath}.grid_labels.${element.key.toLowerCase()}`
        })
      })
      //Adds print col in 0 || 1 position based on menu_conf 
      if (nextProps.printout && !currGrid.some((col) => col.key === PRINT_COLUMN_KEY)) {
        currGrid.unshift({
          key: PRINT_COLUMN_KEY,
          name: '',
          width: 50,
          sortable: false,
          resizable: false,
          filterable: false,
          cellClass: 'print-button-cell',
          formatter: <PrintButtonFormatter printout={nextProps.printout} />
        })
      }
      this.setState({ gridConfig: currGrid })
    }
    if (nextProps.gridData && nextProps.gridConfig) {
      // this.setState({ rows: nextProps.gridData })
      const formattedData = this.formatDates(nextProps.gridConfig, nextProps.gridData)
      const stateUpdate = { rows: formattedData }
      // Detect the actual PKID key from the row data (the prefix may differ from configTableName)
      if (isValidArray(formattedData, 1)) {
        const actualRowKey = Object.keys(formattedData[0]).find(k => k.endsWith('.PKID'))
        if (actualRowKey) {
          stateUpdate.rowKey = actualRowKey
        }
      }
      this.setState(stateUpdate)
    }

    if (nextProps.reloadGrid !== null && nextProps.reloadGrid !== undefined) {
      if (nextProps.reloadGrid === true && this.state.gridDataLoaded === true && this.state.reloadGrid !== nextProps.reloadGrid) {
        this.setState({ gridDataLoaded: false, filters: [], filteredRows: undefined }, () => {
          this.getGridData(nextProps.params, { configTableName: nextProps.configTableName, dataTableName: nextProps.dataTableName })
        })
      }
    }

    if (this.props.gridConfigLoaded !== nextProps.gridConfigLoaded || this.props.gridConfig !== nextProps.gridConfig) {
      if (nextProps.gridConfigLoaded === false && nextProps.gridConfig.constructor !== Array) {
        alertUserResponse({ response: nextProps.gridConfig?.response })
        this.setState({ hideLoader: true })
      }
    }

    if (this.props.gridDataLoaded !== nextProps.gridDataLoaded || this.props.gridData !== nextProps.gridData) {
      if (nextProps.gridDataLoaded === false && nextProps.gridData.constructor !== Array) {
        alertUserResponse({ response: nextProps.gridData?.response })
        this.setState({ hideLoader: true })
      }
    }

    if (nextProps.inlineSaveResult && (nextProps.inlineSaveResult !== this.props.inlineSaveResult)) {
      this.setState({ requestPending: false })
      if (nextProps.inlineSaveResult.type === 'ERROR' || nextProps.inlineSaveResult.type === 'EXCEPTION') {
        this.setState({
          hideLoader: true,
          alert: alertUser(
            true, 'error', nextProps.inlineSaveResult.title, nextProps.inlineSaveResult.message,
            () => {
              this.setState({ alert: alertUser(false, 'info', ' ') })
              store.dispatch(resetGridEditResponseState(this.state.id))
              this.updateRowsAfterSave(this, nextProps)
            }, undefined, false, undefined, undefined, false, undefined)
        })
      } else {
        this.updateRowsAfterSave(this, nextProps)
      }
    }
  }

  componentWillUnmount() {
    ComponentManager.cleanComponentReducerState(this.props.id)
  }

  updateRowsAfterSave(comp, nextProps) {
    const savedObject = nextProps.inlineSaveResult.data
    const rowId = savedObject.ROW_ID
    delete savedObject.ROW_ID
    let rows = this.selectRows(this.state)
    let filteredRows = comp.state.filteredRows
    if (filteredRows && filteredRows.constructor === Array) {
      if (filteredRows.length > 0) {
        this.getGridData()
      }
    } else {
      rows[rowId] = savedObject
      this.setState({ gridData: rows })
    }
    store.dispatch(resetGridEditResponseState(comp.state.id))
  }
  onSelectedRowsChange(rows) {
    if (this.state.onSelectChangeFunct !== null && this.state.onSelectChangeFunct !== undefined) {
      this.state.onSelectChangeFunct(rows, this.state.id)
    }
  }

  UNSAFE_componentWillMount() {
    this.getGridConfig()
    if (!this.state.gridDataLoaded) {
      this.getGridData(this.state.params)
    }
    if (this.state.filters || this.state.filteredRows || this.state.selectedKeys) {
      ComponentManager.setStateForComponent(this.state.id, null, { filteredRows: undefined, filters: [], selectedKeys: [], selectedRowData: [] })
    }
  }

  filterValues(row, columnFilter, columnKey) {
    let include = true
    if (columnFilter === null) {
      include = false
    } else if (!(Array.isArray(columnFilter.filterTerm) && columnFilter.filterTerm.length === 0)) {
      const options = columnFilter.column && columnFilter.column.formatterOptions
      include = this.columnValueContainsSearchTerms(row[columnKey], columnFilter.filterTerm, cellCodeListValues(row, columnKey, options))
    }
    return include
  }

  /* A row passes a dropdown filter when its cell is the value picked in the filter, or, for a cell
  holding more than one value, when the picked value is one of the values that cell lists. The
  values of the cell are the same ones getValidFilterValues offered in the dropdown, so a pick
  always matches the row it was read from. */
  columnValueContainsSearchTerms(columnValue, filterTerms, cellValues = []) {
    let columnValueContainsSearchTerms = false
    const values = cellValues.map((value) => `${value}`)
    for (const key in filterTerms) {
      if (!Object.prototype.hasOwnProperty.call(filterTerms, key)) {
        continue
      }
      if (columnValue !== undefined && filterTerms[key] && filterTerms[key].value !== undefined) {
        const strColumnValue = columnValue.toString()
        const filterTermValue = filterTerms[key].value.toString()
        if (strColumnValue === filterTermValue || values.includes(filterTermValue)) {
          columnValueContainsSearchTerms = true
          break
        }
      }
    }
    return columnValueContainsSearchTerms
  }

  getGridConfig() {
    store.dispatch(getGridConfig(this.state.id, this.state.configTableName, this.state.session, this.state.params, this.state.gridType))
  }

  getGridData(params, getNewData) {
    if (getNewData) {
      store.dispatch(getGridData(this.state.id, getNewData.dataTableName, this.state.session, params, this.state.gridType, 100))
    } else {
      store.dispatch(getGridData(this.state.id, this.state.dataTableName, this.state.session, params, this.state.gridType, 100))
    }
  }

  handleFilterChange(filter) {
    const newFilters = Object.assign({}, this.state.filters)
    if (filter.filterTerm) {
      if (filter.column.formatterType !== null && filter.column.formatterType !== undefined && filter.column.formatterType === 'DropDownFormatter') {
        filter.filterValues = this.filterValues
      }
      newFilters[filter.column.key] = filter
    } else {
      delete newFilters[filter.column.key]
    }

    const filteredRows = getRows({ filters: newFilters, rows: this.state.rows })
    this.setState({ filteredRows, filters: newFilters })
  }

  onClearFilters() {
    this.setState({ filteredRows: undefined, filters: [] })
  }

  onRowsSelected(rows) {
    const newKeys = rows.map(r => r.row[this.state.rowKey])
    const newRows = rows.map(r => r.row)
    const selectedKeys = [...this.state.selectedKeys, ...newKeys]
    const selectedRowData = [...this.state.selectedRowData, ...newRows]
    this.setState({ selectedKeys, selectedRowData })
    this.onSelectedRowsChange(selectedRowData, this.state.id)
  }

  onRowsDeselected(rows) {
    const removedKeys = new Set(rows.map(r => r.row[this.state.rowKey]))
    const selectedKeys = this.state.selectedKeys.filter(k => !removedKeys.has(k))
    const selectedRowData = this.state.selectedRowData.filter(r => !removedKeys.has(r[this.state.rowKey]))
    this.setState({ selectedKeys, selectedRowData })
    this.onSelectedRowsChange(selectedRowData, this.state.id)
  }

  getRows() {
    const filteredRows = this.selectRows(this.state)
    return filteredRows
  }

  rowGetter(i) {
    const rows = this.getRows()
    return rows[i]
  }

  getSize() {
    return this.getRows().length
  }

  onRowClick(rowIdx, row) {
    if (rowIdx > -1 && !this.state.handleRowUpdatedFunct) {
      store.dispatch(rowClicked(this.state.id, row, rowIdx))
      if (this.state.onRowClickFunct && (typeof this.state.onRowClickFunct === 'function')) {
        this.state.onRowClickFunct(this.state.id, rowIdx, row)
      } else if (this.state.onRowClickFunct && !(typeof this.state.onRowClickFunct === 'function')) {
        console.warn('Cannot invoke onRowClick since it is not a function.')
      }
    }
  }

  handleRowUpdated(commit) {
    if (this.state.active && this.state.handleRowUpdatedFunct) {
      this.setState({ requestPending: true })
      let rows = this.selectRows(this.state)
      this.state.handleRowUpdatedFunct(this, rows, commit.fromRow, commit.updated)
    } else {
      console.warn('No inline grid save function provided. No default function found.')
    }
  }

  handleGridRowsUpdated({ fromRow, toRow, updated }) {
    const rows = this.state.rows.slice()
    for (let i = fromRow; i <= toRow; i++) {
      const rowToUpdate = rows[i]
      const updatedRow = React.addons.update(rowToUpdate, { $merge: updated })
      rows[i] = updatedRow
    }

    this.setState({ rows })
  }

  componentDidUpdate() {
    this.props.refFunction(this)
  }

  /* The values offered in a column's filter dropdown: every value its rows hold, decoded to the
  text the grid shows for it. Multi value cells contribute each of their values separately, and a
  value the code list does not know is offered as it stands rather than dropped, which is the case
  for fields the backend sends already translated. */
  getValidFilterValues(columnId) {
    const columns = this.state.gridConfig
    if (!isValidArray(columns, 1) || !isValidArray(this.state.rows, 1)) {
      return []
    }
    const config = columns.find((column) => column.key === columnId)
    if (!config) {
      return []
    }
    const options = config.formatterOptions
    const values = new Map()
    this.state.rows.forEach((row) => {
      cellCodeListValues(row, columnId, options).forEach((value) => {
        if (!values.has(value)) {
          values.set(value, { value, label: codeListText(options, value) })
        }
      })
    })
    return Array.from(values.values())
  }

  addRow() {
    if (this.state.addRowSubgrid) this.state.addRowSubgrid()
  }

  handleGridSort = (sortColumn, sortDirection) => {
    this.setState({ sortColumn, sortDirection })
  }

  customButton = () => {
    const { customButton, toggleCustomButton } = this.state
    if (toggleCustomButton && customButton) {
      customButton()
    }
  }

  refreshData = () => {
    if (typeof this.state.refreshData === 'boolean') {
      GridManager.reloadGridData(this.state.id)
    } else {
      if (typeof this.state.refreshData === 'function') {
        this.state.refreshData()
      } else {
        const title = this.context.intl.formatMessage({ id: `${labelBasePath}.error.refresh_data`, defaultMessage: `${labelBasePath}.error.refresh_data` })
        alertUserV2({ type: 'info', title })
      }
    }
  }

  render() {
    const rowText = this.state.selectedKeys.length === 1
      ? this.context.intl.formatMessage(
        { id: `${labelBasePath}.row_selected`, defaultMessage: `${labelBasePath}.row_selected` }
      ) : this.context.intl.formatMessage(
        { id: `${labelBasePath}.rows_selected`, defaultMessage: `${labelBasePath}.rows_selected` }
      )

    let finalHeight
    let heightRatio = 0.8
    let className = this.state.className

    if (this.props.heightRatio) {
      heightRatio = this.props.heightRatio
    }

    if (!this.props.defaultHeight) {
      finalHeight = this.state.minHeight > 0 ? this.state.minHeight : (window.innerHeight * heightRatio)
    }
    // const finalWidth = this.state.minWidth > 0 ? this.state.minWidth : (window.innerWidth * 0.772)
    const rowClicked = this.state.rowClicked || undefined

    const imgHeight = finalHeight / 10
    const margin = (finalHeight / 2) - imgHeight

    if (!className) {
      className = 'reactGrid'
    }

    const NoData = () => {
      /* Displays a message and an image inside the grid when no rows are retreived
      The image must be supplied from outside the components package */
      return <div style={{ 'marginTop': margin, 'fontWeight': 'bold' }}>
        {this.context.intl.formatMessage({
          id: `${labelBasePath}.main.grids.no_data`,
          defaultMessage: `${labelBasePath}.main.grids.no_data`
        })}
        <br />
        {<Icon name='IconBoxOff' />}
      </div>
    }

    return (
      <div>
        {this.state.alert}
        {(!this.state.gridConfigLoaded || !this.state.gridDataLoaded || this.state.requestPending) && !this.state.hideLoader &&
          <div>
            <Loading />
          </div>
        }

        {this.state.gridConfigLoaded && this.state.gridDataLoaded && this.state.gridConfig &&
          <div id={className} className={className}>
            <div id='separateText' className='separator' />
            <ReactDataGrid
              enableCellSelect
              rowKey={this.state.rowKey}
              columns={this.state.gridConfig}
              rowGetter={this.rowGetter}
              rowsCount={this.getSize()}
              // minWidth={finalWidth}
              minHeight={finalHeight}
              minColumnWidth={this.state.minColumnWidth}
              className={this.state.className}
              headerRowHeight={50}
              toolbar={
                <CustomGridToolbar
                  enableFilter
                  hasLinkGridInModal={this.state.hasLinkGridInModal}
                  {...this.state.buttonsArray && { buttonsArray: this.state.buttonsArray }}
                  {...this.state.toggleCustomButton && { customButtonLabel: this.state.customButtonLabel }}
                  {...this.state.toggleCustomButton && { additionalButtonLabel: this.state.additionalButtonLabel }}
                  {...this.state.toggleCustomButton && { additionalButton: this.state.additionalButton }}
                  {...this.state.toggleCustomButton && { customButton: this.customButton }}
                  {...this.state.addRowSubgrid && { onAddRow: this.addRow }}
                  {...this.state.toggleCustomButton && { customButtonClassName: this.state.customButtonClassName }}
                  {...this.state.toggleCustomButton && { additionalButtonClassName: this.state.additionalButtonClassName }}
                  {...this.state.toggleCustomButton && { customButtonTitle: this.state.customButtonTitle }}
                  addRowButtonText={
                    this.context.intl.formatMessage({ id: `${labelBasePath}.main.grids.add`, defaultMessage: `${labelBasePath}.main.grids.add` })
                  }
                  filterRowsButtonText={
                    this.context.intl.formatMessage({ id: `${labelBasePath}.main.grids.search`, defaultMessage: `${labelBasePath}.main.grids.search` })
                  }
                >
                  {this.state.refreshData && (
                    <div className='refresh-data-container'>
                      <span id='refreshData' className='refreshData' onClick={this.refreshData}>
                        {<Icon name='IconRefresh' />}
                      </span>
                    </div>
                  )}
                  {(this.state.filteredRows && this.state.filteredRows.length > 0 && this.state.rows)
                    ? <div className='rowcount-container'>
                      <span id='reactGridspan1'>{this.context.intl.formatMessage({ id: `${labelBasePath}.main.grids.rowcount`, defaultMessage: `${labelBasePath}.main.grids.rowcount` })} {this.state.filteredRows.length}</span>
                    </div>
                    : <div className='rowcount-container'>
                      <span id='reactGridspan2'>{this.context.intl.formatMessage({ id: `${labelBasePath}.main.grids.rowcount`, defaultMessage: `${labelBasePath}.main.grids.rowcount` })} {this.state.rows.length}</span>
                    </div>
                  }
                  {this.state.enableMultiSelect === true && (
                    <div className='selected-rows-container'>
                      <span id='reactGridspan3' style={{ paddingLeft: '10px' }}>{`${this.state.selectedKeys.length} ${rowText}`}</span>
                    </div>
                  )}
                  {this.props.customToolbarDescription && (
                    <div className='custom-toolbar-description'>
                      <p className='custom-toolbar-msg'>{this.props.customToolbarDescription}</p>
                    </div>
                  )}
                </CustomGridToolbar>
              }
              onAddFilter={this.handleFilterChange}
              onClearFilters={this.onClearFilters}
              onRowClick={this.onRowClick}
              getValidFilterValues={this.getValidFilterValues}
              onGridRowsUpdated={this.handleRowUpdated}
              rowRenderer={customRowRendererSecondary()}
              {...rowClicked && { rowRenderer: customRowRenderer(rowClicked.ROW_ID, rowClicked) }}
              rowSelection={this.state.enableMultiSelect === true ? {
                showCheckbox: true,
                enableShiftSelect: true,
                onRowsSelected: this.onRowsSelected,
                onRowsDeselected: this.onRowsDeselected,
                selectBy: {
                  keys: {
                    rowKey: this.state.rowKey,
                    values: this.state.selectedKeys
                  }
                }
              } : null}
              onGridSort={this.handleGridSort}
              RowsContainer={ContextMenuTrigger}
              contextMenu={<ContextMenuPopup
                rows={this.state.filteredRows || this.state.rows}
                id={this.state.id}
                enableMultiSelect={this.state.enableMultiSelect}
                gridConfig={this.state.gridConfig}
                editContextFunc={this.props.editContextFunc} />
              }
              emptyRowsView={NoData}
            />
          </div>
        }
      </div>
    )
  }
}

GenericGrid.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  gridLang: state.intl.locale
})

export default WrapItUp(connect(mapStateToProps)(GenericGrid), 'GenericGrid', undefined, true)