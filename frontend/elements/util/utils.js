export function $(x) {
  return document.getElementById(x)
}

export function replaceConfigParamsWithFieldVals(string, session) {
  string = string.replace('{token}', session)
  const array = string.split('/')
  for (let i = 0; i < array.length; i++) {
    if (array[i].charAt(0) === '{' && array[i].charAt(array[i].length - 1) === '}') {
      const fieldId = array[i].slice(1, -1)
      array[i] = document.getElementById(fieldId).value
    }
  }
  string = array.join('/')
  return string
}

// Splits the first property found at any depth on commas, in place.
export function convertStringToArrayInFormData(dataObject, property) {
  let result = null
  for (const key in dataObject) {
    if (key === property) {
      dataObject[key] = dataObject[key].split(',')
      return dataObject[key]
    }
    if (dataObject[key] instanceof Object) {
      result = convertStringToArrayInFormData(dataObject[key], property)
      if (result) {
        break
      }
    }
  }
  return result
}

// The first field at any depth whose [key] is widget.
export function findWidget(schemaObject, key, widget) {
  let result = null
  for (const property in schemaObject) {
    if (schemaObject[property] && schemaObject[property][key] &&
      schemaObject[property][key] === widget) {
      return property
    }
    if (schemaObject[property] instanceof Object) {
      result = findWidget(schemaObject[property], key, widget)
      if (result) {
        break
      }
    }
  }
  return result
}

export function findSectionName(schemaObject, field) {
  let result = null
  for (const property in schemaObject) {
    if (schemaObject[property] && schemaObject[property][field]) {
      return property
    }
    if (schemaObject[property] instanceof Object) {
      result = findSectionName(schemaObject[property], field)
      if (result) {
        break
      }
    }
  }
  return result
}
