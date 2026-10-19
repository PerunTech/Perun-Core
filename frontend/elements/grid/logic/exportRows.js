import { decodeCellValue } from './codeList';

/* What a grid's CSV and Excel files hold, and what copying a row or a cell from its context menu
puts on the clipboard: its rows with their values decoded as the grid shows them. */

/* This function returns a JSON object from a filtered selection, where one object in the array
represents one filtered row. Accepts 2 parameters: grid configuration and array of filtered rows.
The table row names and table data are decoded, using the grid config formatter options functionality,
and as such are saved in the array. Internal system data (such as pkid, object_id, parent_id etc...)
is also automatically removed since it corresponds to no relevant data in the grid config formatter.
If no data was filtered, the function returns an empty array. */
export function prepJsonFromConf(gridConfig, arrOfObj) {
  let cleanArray = []
  if (gridConfig && arrOfObj) {
    const confLen = gridConfig.length
    // create a new array of objects with decoded values
    cleanArray = arrOfObj.map((element) => {
      // create a new object element for each one in data array
      let newElement = {}
      for (let i = 0; i < confLen; i++) {
        const key = gridConfig[i].key
        const formattedKey = gridConfig[i].name
        const value = element[key]
        // see if property defined in config holds something in the data array
        if (value !== null && value !== undefined && value !== '') {
          newElement[formattedKey] = decodeCellValue(gridConfig[i], element)
        } else {
          /* if the field in config is not present in the data array, add an empty string
          so as not to get undefined values in document */
          newElement[formattedKey] = ' '
        }
      }
      // return the newly created decoded element
      return newElement
    })
  }
  // return the new array
  return cleanArray
}

/**
 * The rows a grid's export file holds: all its rows, or the filtered ones if any filters are
 * present, decoded by prepJsonFromConf, followed by a row per filter value saying what the rows
 * were filtered by.
 * @param {object} grid - `gridConfig`, `filters`, `filteredRows` and `rows`, as the grid's slice holds them.
 * @param {string} filterByLabel - The text before a filter's column name in those last rows.
 * @returns {Array} An empty array when there are no records to export.
 */
export function exportRows({ gridConfig, filters, filteredRows, rows }, filterByLabel) {
  const filterCriteria = []
  let arrOfObj
  let jsonData = []
  if (filters.constructor === Object && Object.keys(filters).length > 0) {
    arrOfObj = filteredRows
    for (const i in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, i)) {
        const filteredObj = {}
        let filterKey = ''
        let filterTerms = ''
        filterKey = filters[i].column.name
        filterTerms = filters[i].filterTerm
        for (let j = 0; j < filterTerms.length; j++) {
          filteredObj[`${filterByLabel}: ${filterKey}`] = filterTerms[j].label
          filterCriteria.push(filteredObj)
        }
      }
    }
  } else {
    arrOfObj = rows
  }
  // decode all table row names and their respective data- return array of objects
  const filterJson = prepJsonFromConf(gridConfig, arrOfObj)
  if (filterJson.length > 0) {
    jsonData = filterJson.concat(filterCriteria)
  }
  return jsonData
}
