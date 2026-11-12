import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { WrapItUp, ComponentManager, alertUserResponse } from '..';
import GenericGrid from './GenericGrid';
import { Loading } from '../../components/ComponentsIndex';
import { exportRows } from './logic/exportRows';
import { writeCsv, writeExcel } from './logic/exportFiles';
import { label } from './logic/labels';
import { shownExports } from './logic/hiddenExports';

// hiddenExports: true, or the formats to leave out. GridManager.setHiddenExports overrides it on a
// mounted grid.

// So a fast export doesn't flash the overlay.
const EXPORT_LOADING_DELAY_MS = 200

// The .csv is named by the grid's id as is, the Excel files by it in lower case.
const EXPORTS = [
  { format: 'csv', id: 'btn_exportCsv', className: 'btnExportCsv', text: '.CSV', write: writeCsv, fileName: (id) => `${id}.csv` },
  { format: 'xls', id: 'export-excel-xls', className: 'btnExportExcel', text: '.XLS', write: writeExcel, fileName: (id) => `${id.toLowerCase()}.xls` },
  { format: 'xlsx', id: 'export-excel-xlsx', className: 'btnExportExcel', text: '.XLSX', write: writeExcel, fileName: (id) => `${id.toLowerCase()}.xlsx` }
]

// Rows are read before the writer loads, so the file holds what the grid showed at the click.
function exportGrid(id, intl, { write, fileName }) {
  const rows = exportRows(ComponentManager.getStateForComponent(id), label(intl, 'main.grids.filter_by'))
  if (rows.length === 0) {
    return Promise.resolve()
  }
  return write(rows, fileName(id)).catch((err) => {
    console.error(err)
    alertUserResponse({ response: err })
  })
}

const ExportableGrid = (props) => {
  const intl = useIntl()
  // The first export of a kind fetches its library, slow enough on a poor connection to need this.
  const [exporting, setExporting] = useState(false)
  const runExport = (generate) => {
    const showLoading = setTimeout(() => setExporting(true), EXPORT_LOADING_DELAY_MS)
    // Through a promise, so that a throw while the rows are read still clears the overlay.
    Promise.resolve().then(generate).finally(() => {
      clearTimeout(showLoading)
      setExporting(false)
    })
  }

  const shown = shownExports(EXPORTS, props.hiddenExports)

  return (
    <div id='exportableGridHolder' className='exportableGridHolder'>
      {exporting && <Loading />}
      <GenericGrid {...props} />
      {props.gridConfigLoaded && props.gridDataLoaded && shown.length > 0 &&
        <div id='exportBtns' className='exportBtnsHolder' style={{ marginLeft: props.floatDownloadBtnsToRight && 'auto' }}>
          {shown.map((format) => (
            <button
              key={format.id}
              id={format.id}
              className={`btn btn-success ${format.className}`}
              onClick={() => runExport(() => exportGrid(props.id, intl, format))}>
              {format.text}
            </button>
          ))}
        </div>
      }
    </div>
  )
}

export default WrapItUp(ExportableGrid, 'GenericGrid', undefined, true)
