import { decodeCellValue } from './codeList';

// Shared by the CSV and Excel files and the context menu's copy.

// Rows with their keys and values decoded through the grid config; fields the config doesn't hold
// (pkid, object_id, parent_id) are dropped.
export function prepJsonFromConf(gridConfig, arrOfObj) {
  let cleanArray = []
  if (gridConfig && arrOfObj) {
    const confLen = gridConfig.length
    cleanArray = arrOfObj.map((element) => {
      let newElement = {}
      for (let i = 0; i < confLen; i++) {
        const key = gridConfig[i].key
        const formattedKey = gridConfig[i].name
        const value = element[key]
        if (value !== null && value !== undefined && value !== '') {
          newElement[formattedKey] = decodeCellValue(gridConfig[i], element)
        } else {
          // A space, not undefined, in the file.
          newElement[formattedKey] = ' '
        }
      }
      return newElement
    })
  }
  return cleanArray
}

// All the rows, or the filtered ones, then a row per filter value saying what they were filtered by.
export function exportRows({ gridConfig, filters, filteredRows, rows }, filterByLabel) {
  const filterCriteria = []
  let arrOfObj
  let jsonData = []
  if (filters.constructor === Object && Object.keys(filters).length > 0) {
    arrOfObj = filteredRows
    for (const i in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, i)) {
        const { column, filterTerm } = filters[i]
        const terms = Array.isArray(filterTerm) ? filterTerm.map((term) => term.label) : [filterTerm]
        terms.forEach((term) => filterCriteria.push({ [`${filterByLabel}: ${column.name}`]: term }))
      }
    }
  } else {
    arrOfObj = rows
  }
  const filterJson = prepJsonFromConf(gridConfig, arrOfObj)
  if (filterJson.length > 0) {
    jsonData = filterJson.concat(filterCriteria)
  }
  return jsonData
}
