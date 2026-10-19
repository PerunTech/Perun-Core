import { loadModule } from '../../../functions/modules';
import { downloadBlob } from '../../guides/helpExport';

/* Write rows, as exportRows makes them, to a file the browser downloads. Neither writer is in the
bundle: each is loaded the first time somebody exports (frontend/modules/csv.js and xlsx.js), and
kept after. The promise settles once the file is written, or rejects when the writer did not load. */

export function writeCsv(rows, fileName) {
  return loadModule('csv').then(({ Parser }) => {
    const csv = new Parser({ withBOM: true }).parse(rows)
    downloadBlob(fileName, new Blob([csv], { type: 'text/csv' }))
  })
}

// An .xls or an .xlsx file, as `fileName` ends.
export function writeExcel(rows, fileName) {
  return loadModule('xlsx').then(({ default: xlsx }) => {
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rows))
    xlsx.writeFile(workbook, fileName)
  })
}
