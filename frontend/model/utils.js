import axios from 'axios';

export const switchServerLanguage = (lang, token) => {
  let url = window.server + `/SvSecurity/i18n/${lang}/perun/${token}`
  axios.get(url).then(() => {
  }).catch(err => {
    console.error(err)
  })
}

export const svSessionRegxp = value => /^([a-zA-Z0-9_-]){36}$/.test(value);

export function flattenJson(data) {
  let result = {}
  function recurse(num, prop) {
    if (Object(num) !== num) {
      result[prop] = num
    } else if (Array.isArray(num)) {
      for (var i = 0, l = num.length; i < l; i++) {
        recurse(num[i], prop)
      }
      if (l === 0) {
        result[prop] = []
      }
    } else {
      let isEmpty = true
      for (const p in num) {
        isEmpty = false
        recurse(num[p], prop ? prop + '.' + p : p)
      }
      if (isEmpty && prop) {
        result[prop] = {}
      }
    }
  }
  recurse(data, '')
  return result
}

export function ConvertObjectKeysToUpperCase(obj) {
  let output = {}
  for (const i in obj) {
    if (Object.prototype.toString.apply(obj[i]) === '[object Object]') {
      output[i.toUpperCase()] = ConvertObjectKeysToUpperCase(obj[i])
    } else if (Object.prototype.toString.apply(obj[i]) === '[object Array]') {
      output[i.toUpperCase()] = []
      output[i.toUpperCase()].push(ConvertObjectKeysToUpperCase(obj[i][0]))
    } else {
      output[i.toUpperCase()] = obj[i]
    }
  }
  return output
}

export function replaceSpecialCharsInJson(value) {
  const replaceSlash = ',P!_1-'
  const replaceBackSlash = ',P!_2-'
  value = value.split('/').join(replaceSlash)
  return value.split('\\').join(replaceBackSlash)
}

export function goBack() {
  window.history.back()
}

// Deep: Object.assign copies only the top level.
export function cloneObject(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    const clonedArr = [];
    obj.forEach((element) => {
      clonedArr.push(cloneObject(element))
    });
    return clonedArr;
  }

  let clonedObj = new obj.constructor();
  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      clonedObj[prop] = cloneObject(obj[prop]);
    }
  }
  return clonedObj;
}

export function isValidArray(array, minNumberOfElements) {
  if (minNumberOfElements) {
    return (array && array.constructor === Array && array.length >= minNumberOfElements)
  } else {
    return (array && array.constructor === Array)
  }
}

export function isValidObject(object, minNumberOfKeys) {
  if (minNumberOfKeys) {
    return (object && object.constructor === Object && Object.keys(object).length >= minNumberOfKeys)
  } else {
    return (object && object.constructor === Object)
  }
}

// Equal ignoring case and accents.
export function strcmp(firstValue, secondValue) {
  if ((typeof firstValue === 'string' && typeof secondValue === 'string') || (firstValue instanceof String && secondValue instanceof String)) {
    return firstValue.localeCompare(secondValue, undefined, { sensitivity: 'base' }) === 0 ? true : false
  } else {
    return false
  }
}

export function flattenObject(obj) {
  const flattened = {}
  Object.keys(obj).forEach((key) => {
    if (strcmp(typeof obj[key], 'object') && obj[key] !== null) {
      Object.assign(flattened, flattenObject(obj[key]))
    } else {
      flattened[key] = obj[key]
    }
  })
  return flattened
}
