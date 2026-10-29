import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { WrapItUp, ComponentManager, alertUserResponse } from '..';
import GenericGrid from './GenericGrid';
import { Loading } from '../../components/ComponentsIndex';
import { exportRows } from './logic/exportRows';
import { writeCsv, writeExcel } from './logic/exportFiles';
import { label } from './logic/labels';

/* GenericGrid with three buttons below it, which download the rows it shows as a .csv, .xls or .xlsx
file named after the grid: all of them, or those its filters leave, followed by a row per filter
value saying what they were filtered by (see logic/exportRows.js). */

/* How long an export runs before the loading overlay is shown, so that a fast one does not flash
it. */
const EXPORT_LOADING_DELAY_MS = 200

// The buttons, in order. The .csv file is named by the grid's id as it is, the Excel files by it in lower case.
const EXPORTS = [
  { id: 'btn_exportCsv', className: 'btnExportCsv', text: '.CSV', write: writeCsv, fileName: (id) => `${id}.csv` },
  { id: 'export-excel-xls', className: 'btnExportExcel', text: '.XLS', write: writeExcel, fileName: (id) => `${id.toLowerCase()}.xls` },
  { id: 'export-excel-xlsx', className: 'btnExportExcel', text: '.XLSX', write: writeExcel, fileName: (id) => `${id.toLowerCase()}.xlsx` }
]

/* The rows are read from the grid's slice before the writer is loaded, so the file holds what the
grid showed at the click. The promise settles once the file is written, at once when there are no
rows, or once a writer that did not load has been reported. */
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
          {EXPORTS.map((format) => (
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
