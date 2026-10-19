import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { labelBasePath } from '../../config';
import { WrapItUp, ComponentManager, alertUserResponse } from '..';
import GenericGrid from './GenericGrid';
import { Loading } from '../../components/ComponentsIndex';
import { loadModule } from '../../functions/modules';
import { exportRows } from './logic/exportRows';

/* This extension component adds a downloadable filter option to the grid,
with every result from the filter in the grid is displayed as a new row in the excel (csv) format.
The header of the excel file represents the filter applied to the grid.
*/
/* A function that returns all rows (or the filtered ones if any filters are present) for selected grid,
as logic/exportRows.js decodes them. Returns JSON or an empty array if there are no records to display. */
function getRows(grid, intl) {
  let filterByLabel = intl.formatMessage({
    id: `${labelBasePath}.main.grids.filter_by`,
    defaultMessage: `${labelBasePath}.main.grids.filter_by`
  })
  return exportRows({
    gridConfig: ComponentManager.getStateForComponent(grid, 'gridConfig'),
    filters: ComponentManager.getStateForComponent(grid, 'filters'),
    filteredRows: ComponentManager.getStateForComponent(grid, 'filteredRows'),
    rows: ComponentManager.getStateForComponent(grid, 'rows')
  }, filterByLabel)
}

/* A function that converts filtered JSON rows to CSV. Creates and downloads a .csv document. The CSV
writer is loaded the first time somebody exports (frontend/modules/csv.js), as the Excel library is
below, and settles the same way. */
function generateCsv(grid, intl) {
  const dataForCsv = getRows(grid, intl)
  if (dataForCsv.length === 0) return Promise.resolve()
  return loadModule('csv').then(({ Parser }) => {
    // transform json to csv and create a link which donwloads the document when it is synthetically clicked
    const csvParser = new Parser({ withBOM: true })
    const csv = csvParser.parse(dataForCsv)
    const data = new Blob([csv], { type: 'text/csv' })
    const csvURL = window.URL.createObjectURL(data)
    const tempLink = document.createElement('a')
    tempLink.href = csvURL
    tempLink.setAttribute('download', `${grid}.csv`)
    tempLink.click()
  }).catch((err) => {
    console.error(err)
    alertUserResponse({ response: err })
  })
}

/* Download document as Excel .xls or .xlsx format. The Excel library is not in the bundle: it is
loaded the first time somebody exports (frontend/modules/xlsx.js), and kept after. The rows are
read before it is, so the file holds what the grid showed at the click. The promise settles once
the file is written or the load has failed and been reported. */
function generateExcel(gridId, intl, extension) {
  const gridData = getRows(gridId, intl)
  if (gridData.length === 0) return Promise.resolve()
  const filename = `${gridId.toLowerCase()}.${extension}`
  return loadModule('xlsx').then(({ default: xlsx }) => {
    const worksheet = xlsx.utils.json_to_sheet(gridData)
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, worksheet)
    xlsx.writeFile(workbook, filename)
  }).catch((err) => {
    console.error(err)
    alertUserResponse({ response: err })
  })
}

/* How long an export runs before the loading overlay is shown, so that a fast one does not flash
it. */
const EXPORT_LOADING_DELAY_MS = 200

const ExportableGrid = (props) => {
  const intl = useIntl()
  /* The first export of each kind fetches its library, which is slow enough on a poor connection
  that the click would otherwise seem to have done nothing. Later exports find it loaded, and
  settle before the delay is up. */
  const [exporting, setExporting] = useState(false)
  const runExport = (generate) => {
    const showLoading = setTimeout(() => setExporting(true), EXPORT_LOADING_DELAY_MS)
    // Through a promise, so that a throw while the rows are read still clears the overlay.
    Promise.resolve().then(generate).finally(() => {
      clearTimeout(showLoading)
      setExporting(false)
    })
  }

  return (
    <div id='exportableGridHolder' className='exportableGridHolder'>
      {exporting && <Loading />}
      <GenericGrid {...props} />
      {props.gridConfigLoaded && props.gridDataLoaded &&
        <div id='exportBtns' className='exportBtnsHolder' style={{ marginLeft: props.floatDownloadBtnsToRight && 'auto' }}>
          <button
            id='btn_exportCsv'
            className='btn btn-success btnExportCsv'
            onClick={() => runExport(() => generateCsv(props.id, intl))}>
            .CSV
          </button>
          <button
            id='export-excel-xls'
            className='btn btn-success btnExportExcel'
            onClick={() => runExport(() => generateExcel(props.id, intl, 'xls'))}>
            .XLS
          </button>
          <button
            id='export-excel-xlsx'
            className='btn btn-success btnExportExcel'
            onClick={() => runExport(() => generateExcel(props.id, intl, 'xlsx'))}>
            .XLSX
          </button>
        </div>
      }
    </div>
  )
}

export default WrapItUp(ExportableGrid, 'GenericGrid', undefined, true)
