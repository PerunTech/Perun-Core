import { useEffect, useRef } from 'react'
import { ComponentManager } from '../elements'
import { store, updateSelectedRows, lastSelectedItem } from '../model'
import axios from 'axios'
import validator from '@rjsf/validator-ajv8'
import { createSchemaUtils } from '@rjsf/utils'

export const replaceParamsWithBoundPropVals = (string, props) => {
  let array = string.split('/')
  for (let i = 0; i < array.length; i++) {
    if (array[i].charAt(0) === '{' && array[i].charAt(array[i].length - 1) === '}') {
      let propName = array[i].slice(1, -1)
      if (props[propName]) {
        array[i] = props[propName]
      } else if (array[i] !== '{SVAROG_FORM.OBJECT_ID}') {
        array[i] = '0'
      }
    }
  }
  string = array.join('/')
  return string
}

/**
 * Checks if the given value is valid JSON (either a JSON string that can be parsed, or an already parsed JSON-compatible object).
 * @param {*} value - The value to test. If a string, it will be parsed with `JSON.parse`.
 */
export function isJSON(value) {
  if (typeof value === 'object') return value !== null
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}

export function isValidArray(array, minNumberOfElements) {
  /** returns true if the variable passsed as the first parameter is an array and
  there are at least X number of elements in the array, where X is the second function parameter */
  return (array && array.constructor === Array && array.length >= minNumberOfElements)
}

export function isValidObject(object, minNumberOfKeys) {
  /** returns true if the variable passsed as the first parameter is an object and
    there are at least X number of keys in the object, where X is the second function parameter */
  return (object && object.constructor === Object && Object.keys(object).length >= minNumberOfKeys)
}

export function copyFormData(oldFormData, formUiSchema, formConfig, suffix) {
  /** Copies the already existing data from all the form fields into another set of empty fields
   * ending with the suffix parameter
  */
  let formData = JSON.parse(JSON.stringify(oldFormData))
  if (isValidObject(formData, 1)) {
    for (let fieldId in formData) {
      if (Object.prototype.hasOwnProperty.call(formData, fieldId)) {
        if (!isValidObject(formUiSchema, 1)) {
          formData[`${fieldId}${suffix}`] = formData[fieldId]
          let newFieldId = document.getElementById(`root_${fieldId}${suffix}`)
          if (newFieldId) {
            newFieldId.value = formData[fieldId]
          }
        } else {
          for (let fieldSchemaId in formUiSchema) {
            if (Object.prototype.hasOwnProperty.call(formUiSchema, fieldSchemaId) && fieldSchemaId === `${fieldId}${suffix}`) {
              if (!formUiSchema[fieldSchemaId]['ui:readonly']) {
                if (formConfig.properties[fieldSchemaId].format) {
                  if (formConfig.properties[fieldSchemaId].format === 'date') {
                    const arr = ['year', 'month', 'day']
                    let dateString = ''
                    for (let i = 0; i < arr.length; i++) {
                      const element = document.getElementById(`root_${fieldId}_${arr[i]}`)
                      const index = element.selectedIndex
                      const data = element[index].text
                      dateString = dateString + data + '-'
                      document.getElementById(`root_${fieldSchemaId}_${arr[i]}`).selectedIndex = index
                    }
                    formData[fieldSchemaId] = dateString.slice(0, -1)
                  }
                } else {
                  formData[fieldSchemaId] = formData[fieldId]
                  let newFieldId = document.getElementById(`root_${fieldSchemaId}`)
                  if (newFieldId) {
                    newFieldId.value = formData[fieldId]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return formData
}

export function hasHelpCode(schema) {
  /** returns true if the ui schema, or anything nested in it, carries a ui:helpCode */
  if (!schema || typeof schema !== 'object') return false
  for (const [key, val] of Object.entries(schema)) {
    if (key === 'ui:helpCode') return true
    if (val && typeof val === 'object' && hasHelpCode(val)) return true
  }
  return false
}

export function fillMissingDefaults(defaults, data) {
  /** Copies over the values that exist only in `defaults` - the form data @rjsf/core
    builds for itself by applying the schema defaults - without touching anything `data`
    already carries, a field the user cleared included. Returns `data` itself when there is
    nothing to add, so that repeated calls keep the same reference and don't loop through
    the store. */
  if (Array.isArray(defaults) && Array.isArray(data)) {
    let changed = false
    const merged = data.map((item, index) => {
      const itemWithDefaults = fillMissingDefaults(defaults[index], item)
      if (itemWithDefaults !== item) changed = true
      return itemWithDefaults
    })
    return changed ? merged : data
  }
  if (!isValidObject(defaults, 1) || !isValidObject(data, 0)) return data
  let changed = false
  const merged = { ...data }
  for (const key in defaults) {
    if (!(key in data)) {
      merged[key] = defaults[key]
      changed = true
    } else {
      const valueWithDefaults = fillMissingDefaults(defaults[key], data[key])
      if (valueWithDefaults !== data[key]) {
        merged[key] = valueWithDefaults
        changed = true
      }
    }
  }
  return changed ? merged : data
}

const schemaUtilsCache = new WeakMap()

export function applySchemaDefaults(schema, formData) {
  /** Adds the defaults declared in a json schema to the form data that goes with it.
    @rjsf/core applies them to its own copy of the form data and reports them back through
    onChange only once, so any component that keeps its own copy - GenericForm publishes
    one for consumers to read with ComponentManager.getStateForComponent(id,
    'formTableData') - loses them as soon as it refreshes that copy from the store. This
    puts them back, through the same helper rjsf uses, so the two copies agree. */
  if (!isValidObject(schema, 1)) return formData
  try {
    let schemaUtils = schemaUtilsCache.get(schema)
    if (!schemaUtils) {
      schemaUtils = createSchemaUtils(validator, schema)
      schemaUtilsCache.set(schema, schemaUtils)
    }
    const withDefaults = schemaUtils.getDefaultFormState(schema, formData)
    if (formData === undefined || formData === null) return withDefaults
    return fillMissingDefaults(withDefaults, formData)
  } catch (err) {
    console.warn(err)
    return formData
  }
}

/**
 * Handles the selection of multiple grid rows by dispatching a redux action
 * @param  {array} selectedRows The selected rows in the grid instance
 * @param  {string} gridId The ID of the grid instance
 */
export function handleRowSelection(selectedRows, gridId) {
  store.dispatch(updateSelectedRows(selectedRows, gridId))
}

/**
 * Sets the saveExecuted flag to false for the requested form instance
 * @param  {string} formId The ID of the form instance
 */
export function resetFormSaveState(formId) {
  ComponentManager.setStateForComponent(formId, null, { saveExecuted: false })
}

/**
 * Dispatches a redux action which adds the clicked (selected) row to the application state
 * @param  {string} gridId The ID of the grid instance
 * @param  {object} row The clicked row from the grid instance
 */
export function selectObject(gridId, row) {
  store.dispatch(lastSelectedItem(gridId, row))
}

/**
 * Get the current state of the caps lock key (active/inactive)
 * @param  {KeyboardEvent} event the keyboard event to be checked 
 * @param  {Function} callback callback function that will return the state of the caps lock key
 */
export function getCapsLockState(event, callback) {
  if (event.getModifierState('CapsLock')) {
    callback(true);
  } else {
    callback(false);
  }
}

/**
 * Resolves the backend/assets server origin. window.location.origin is wrong for this when running
 * locally (eg. webpack-dev-server on localhost:PORT) since the actual backend/assets host is configured
 * separately via window.server/window.json (see www/config.js) - use this instead of window.location.origin
 * whenever building a URL to fetch static JSON config or images from that server.
 */
export function getServerOrigin() {
  const fromWindow = window.bundleServer || window.json || window.server || window.location.origin
  return String(fromWindow).replace(/\/services\/?$/, '').replace(/\/$/, '')
}

export const downloadFile = (file, svSession, callback) => {
  if (file['objectId'] && file['fileName']) {
    const url = `${window.server}/ReactElements/downloadFile/sid/${svSession}/object-id/${file['objectId']}/file-name/${file['fileName']}`;
    axios
      .get(url, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res?.data], { type: res?.data?.type });
        const objectUrl = URL.createObjectURL(blob);
        callback(objectUrl)
      })
      .catch(err => {
        console.error('Download error:', err);
      });
  }
};

/**
 * Recursively searches an object for a value corresponding to a specified key.
 *
 * This function checks if the target key exists at the top level of the object.
 * If not, it recursively checks all nested objects for the target key and returns the value if found.
 * If the key is not found in any nested object, it returns `undefined`.
 *
 * @param {Object} obj - The object to search within. Can be a deeply nested object.
 * @param {string} target - The key to search for in the object.
 * @returns {any} The value associated with the target key, or `undefined` if the key is not found.
**/
export const getObjectValueByKey = (obj, target) =>
  target in obj
    ? obj[target]
    : Object.values(obj).reduce((acc, val) => {
      if (acc !== undefined) return acc;
      if (typeof val === 'object') return getObjectValueByKey(val, target);
    }, undefined);

/**
 * Extracts the array index from an rjsf array item element ID.
 * @param {string} elementId - The rjsf element ID, e.g. "root_0_DEPARTMENT" -> "0", "root_12_LAB_OBJ_ID" -> "12".
 */
export const getArrayIndexFromElementId = (elementId) => {
  const withoutRoot = elementId.replace(/^root_/, '')
  return withoutRoot.substring(0, withoutRoot.indexOf('_'))
}

/**
 * Retrieves a localized label using a label code, module name, and internationalization context.
 *
 * @param {string} labelCode - The key used to identify the label (e.g., `'submit'`, `'title'`).
 * @param {{ intl: { formatMessage: function(Object): string } }} context - The internationalization context, typically from `react-intl`.
 * @param {string} [moduleName='main'] - Optional module name for namespacing the label. Defaults to `'main'`.
 */
export const labelsManager = (labelCode, context, moduleName = 'main') => {
  if (!labelCode || !context) return
  return context.intl.formatMessage({
    id: `perun.${moduleName}.${labelCode}`,
    defaultMessage: `perun.${moduleName}.${labelCode}`,
  })
}

/**
 * Retrieves a localized plugin label using the provided label code and context.
 * 
 * @param {string} labelCode - The label code to be appended to the message ID.
 * @param {{ intl: { formatMessage: function(Object): string } }} context - The internationalization context, typically provided by `react-intl`.
 */
export const getPluginLabel = (labelCode, context) => {
  return context.intl.formatMessage({
    id: `perun.plugin.${labelCode}`,
    defaultMessage: `perun.plugin.${labelCode}`
  })
}

/**
 * Custom React hook that returns the previous value of a given input.
 * 
 * This hook uses `useRef` to persist the value across renders and `useEffect` to update the reference after each render.
 * 
 * @param {any} value - The current value to track.
 */
export const usePrevious = (value) => {
  const ref = useRef()

  useEffect(() => {
    ref.current = JSON.parse(JSON.stringify(value))
  }, [value])

  return ref.current
}

/**
 * React hook that triggers a callback when a click occurs outside the referenced element.
 * 
 * @param {Function} handler - Function to call when a user clicks or taps outside the element.
 */
export const useClickOutside = (handler) => {
  const ref = useRef(null)

  useEffect(() => {
    const listener = (event) => {
      const el = ref.current
      if (!el || el.contains(event.target)) {
        return
      }
      handler()
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [handler])

  return ref
}

/**
 * Updates the text content of the DOM element with ID 'identificationScreen'.
 *
 * If the element exists, its `innerText` is set using a label fetched from `getPluginLabel`
 * with the plugin name and the provided `context`.
 *
 * @param {string} pluginLabel - The plugin label
 * @param {any} context - Contextual data used to retrieve the appropriate label from `getPluginLabel`.
 */
export const updateIdScreen = (pluginLabel, context) => {
  const idScreen = document.getElementById('identificationScreen')
  if (idScreen) {
    idScreen.innerText = getPluginLabel(pluginLabel, context)
  }
}

/**
 * Recursively flattens a nested object into a single-level object.
 *
 * This function merges nested properties into the top-level object.
 * If a property is an object (and not `null`), its properties are 
 * recursively added to the resulting object. Keys from nested objects 
 * will overwrite keys at higher levels if they have the same name.
 *
 * @param {object} obj - The object to flatten.
 */
export const flattenObject = (obj) => {
  const flattened = {}
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(flattened, flattenObject(obj[key]))
    } else {
      flattened[key] = obj[key]
    }
  })
  return flattened
}

/**
 * Generates a pseudo-random alphanumeric key based on the current timestamp.
 */
export const getDynamicKey = () => {
  return (+ new Date() + Math.floor(Math.random() * 999999)).toString(36)
}

/**
 * Replaces a placeholder in a string path with a provided value.
 *
 * Searches the input string (`wsPath`) for a placeholder in the format `{<id>.OBJECT_ID}`.
 * If found, replaces it with the provided `obj` value. If not found, returns the original string unchanged.
 *
 * @param {string} wsPath - The string path potentially containing the placeholder.
 * @param {string} id - The identifier used to construct the placeholder (e.g., `user` creates `{user.OBJECT_ID}`).
 * @param {string|number} obj - The value to replace the placeholder with.
 */
export const replaceFunc = (wsPath, id, obj) => {
  if (wsPath.indexOf(`{${id}.OBJECT_ID}`) >= 0) {
    wsPath = wsPath.replace(`{${id}.OBJECT_ID}`, obj)
    return wsPath
  } else {
    return wsPath
  }
}

/**
 * Converts a number of bytes into a human-readable string with appropriate units.
 *
 * @param {number} bytes - The number of bytes to convert.
 * @param {number} decimal - The number of decimal places to include in the result.
 */
export const convertBytes = (bytes, decimal) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimal)) + ' ' + sizes[i]
}

/**
 * Converts a JSON object into a URL-encoded query string.
 *
 * @param {Object} json - The JSON object to convert.
 * @param {boolean} shouldStringify - Whether to stringify object or array values.
 */
export const jsonToURI = (json, shouldStringify) => {
  let arr = []
  for (let property in json) {
    if (Object.prototype.hasOwnProperty.call(json, property) && json[property] !== undefined) {
      if (shouldStringify && typeof json[property] === 'object') {
        if (Array.isArray(json[property])) {
          arr.push(encodeURIComponent(property) + '=' + encodeURIComponent(json[property].toString()))
        } else {
          arr.push(encodeURIComponent(property) + '=' + encodeURIComponent(JSON.stringify(json[property])))
        }
      } else {
        arr.push(encodeURIComponent(property) + '=' + encodeURIComponent(json[property]))
      }
    }
  }
  return arr.join('&')
}

/**
 * A function used for restricting the type of value a user can enter in an
 * input of type 'text' or textarea element (example: only a numeric value or a numeric value in
 * a certain range)
 * @param  {HTMLElement} element The input/textarea whose value we want to restrict
 * @param  {RegExp} inputFilter The filter which will be applied to the input/textarea
 * (the filter will be a regular expression)
 */
export function setInputFilter(element, inputFilter) {
  const events = ['input', 'keydown', 'keyup', 'mousedown', 'mouseup', 'select', 'contextmenu', 'drop']
  events.forEach(function(event) {
    element.addEventListener(event, function() {
      if (inputFilter(this.value)) {
        this.oldValue = this.value
        this.oldSelectionStart = this.selectionStart
        this.oldSelectionEnd = this.selectionEnd
      } else if (Object.prototype.hasOwnProperty.call(this, 'oldValue')) {
        this.value = this.oldValue
        this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd)
      } else {
        this.value = ''
      }
    })
  })
}

/**
 * Formats a timestamp into a human-readable date and time string.
 * The output format is: `DD.MM.YYYY HH:mm:ss`
 * @param {number|string|Date} timestamp - A value accepted by the JavaScript `Date` constructor
 */
export const formatDateAndTime = (timestamp) => {
  const date = new Date(timestamp)
  // Extract date components
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0') // Months are zero-based
  const year = date.getFullYear()
  // Extract time components
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  // Construct the formatted date and time string
  const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
  return formattedDateTime
}
