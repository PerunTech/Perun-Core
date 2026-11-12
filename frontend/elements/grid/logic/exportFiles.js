import { loadModule } from '../../../functions/modules';
import { downloadBlob } from '../../guides/helpExport';

// Each writer is an on-demand module (frontend/modules/csv.js and xlsx.js); rejects when it didn't load.

export function writeCsv(rows, fileName) {
  return loadModule('csv').then(({ Parser }) => {
    const csv = new Parser({ withBOM: true }).parse(rows)
    downloadBlob(fileName, new Blob([csv], { type: 'text/csv' }))
  })
}

// .xls or .xlsx, as fileName ends.
export function writeExcel(rows, fileName) {
  return loadModule('xlsx').then(({ default: xlsx }) => {
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rows))
    xlsx.writeFile(workbook, fileName)
  })
}
