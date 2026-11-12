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
  return (array && array.constructor === Array && array.length >= minNumberOfElements)
}

export function isValidObject(object, minNumberOfKeys) {
  return (object && object.constructor === Object && Object.keys(object).length >= minNumberOfKeys)
}

export function copyFormData(oldFormData, formUiSchema, formConfig, suffix) {
  // Copies each field's value into the field named <field><suffix>.
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
  if (!schema || typeof schema !== 'object') return false
  for (const [key, val] of Object.entries(schema)) {
    if (key === 'ui:helpCode') return true
    if (val && typeof val === 'object' && hasHelpCode(val)) return true
  }
  return false
}

export function fillMissingDefaults(defaults, data) {
  // Never overwrites what data carries, a cleared field included. Returns data itself when nothing
  // is added, so repeated calls keep the reference and don't loop through the store.
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
  // rjsf reports schema defaults through onChange only once, so a component that refreshes its own
  // copy from the store (GenericForm's formTableData) loses them without this.
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

export function handleRowSelection(selectedRows, gridId) {
  store.dispatch(updateSelectedRows(selectedRows, gridId))
}

export function resetFormSaveState(formId) {
  ComponentManager.setStateForComponent(formId, null, { saveExecuted: false })
}

export function selectObject(gridId, row) {
  store.dispatch(lastSelectedItem(gridId, row))
}

export function getCapsLockState(event, callback) {
  if (event.getModifierState('CapsLock')) {
    callback(true);
  } else {
    callback(false);
  }
}

// For static JSON or images from the backend: it can be on another host than the page, so
// window.location.origin is wrong. A relative window.server resolves to '', the page's origin.
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

// Searches nested objects too; undefined when not found or when obj isn't an object.
export const getObjectValueByKey = (obj, target) => {
  if (obj === null || typeof obj !== 'object') return undefined
  if (target in obj) return obj[target]
  for (const val of Object.values(obj)) {
    const found = getObjectValueByKey(val, target)
    if (found !== undefined) return found
  }
  return undefined
}

// "root_12_LAB_OBJ_ID" -> "12"
export const getArrayIndexFromElementId = (elementId) => {
  const withoutRoot = elementId.replace(/^root_/, '')
  return withoutRoot.substring(0, withoutRoot.indexOf('_'))
}

const schemaProperties = (node) => Object.assign({}, ...(node?.allOf || []).map(clause => clause?.then?.properties || {}), node?.properties)

// "root_sample_1_basic_info_TYPE" -> { arrayPath: ['sample'], index: 1, itemPath: ['basic_info'], field: 'TYPE' },
// null outside an array.
export const locateArrayField = (schema, elementId) => {
  const hit = walkElementId(schema, elementId, true)
  if (!hit) return null
  const { keys, arrayAt } = hit
  return { arrayPath: keys.slice(0, arrayAt), index: keys[arrayAt], itemPath: keys.slice(arrayAt + 1, -1), field: keys[keys.length - 1] }
}

// "root_control_program.scope_REGION_CODE" -> ['control_program.scope', 'REGION_CODE'], allOf fields
// included; null inside an array.
export const locateField = (schema, elementId) => walkElementId(schema, elementId, false)?.keys ?? null

// Walks the schema the way rjsf builds its IDs; inArray says whether a hit must be inside an array.
function walkElementId (schema, elementId, inArray) {
  const walk = (node, id, keys, arrayAt) => {
    if (node?.type === 'array' && node.items && !Array.isArray(node.items)) {
      const index = elementId.slice(id.length).match(/^_(\d+)_/)?.[1]
      return index === undefined ? null : walk(node.items, `${id}_${index}`, [...keys, Number(index)], keys.length)
    }
    for (const [key, child] of Object.entries(schemaProperties(node))) {
      const childId = `${id}_${key}`
      if (elementId === childId) return (arrayAt !== undefined) === inArray ? { keys: [...keys, key], arrayAt } : null
      if (elementId.startsWith(`${childId}_`)) {
        const hit = walk(child, childId, [...keys, key], arrayAt)
        if (hit) return hit
      }
    }
    return null
  }
  return typeof elementId === 'string' ? walk(schema, 'root', [], undefined) : null
}

export const schemaAtPath = (schema, keys) =>
  keys.reduce((node, key) => typeof key === 'number' ? node?.items : schemaProperties(node)[key], schema)

export const uiSchemaAtPath = (uiSchema, keys) =>
  keys.reduce((node, key) => node?.[typeof key === 'number' ? 'items' : key], uiSchema)

export const labelsManager = (labelCode, intl, moduleName = 'main') => {
  if (!labelCode || !intl) return
  return intl.formatMessage({
    id: `perun.${moduleName}.${labelCode}`,
    defaultMessage: `perun.${moduleName}.${labelCode}`,
  })
}

export const getPluginLabel = (labelCode, intl) => {
  return intl.formatMessage({
    id: `perun.plugin.${labelCode}`,
    defaultMessage: `perun.plugin.${labelCode}`
  })
}

export const usePrevious = (value) => {
  const ref = useRef()

  useEffect(() => {
    ref.current = JSON.parse(JSON.stringify(value))
  }, [value])

  return ref.current
}

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

export const updateIdScreen = (pluginLabel, intl) => {
  const idScreen = document.getElementById('identificationScreen')
  if (idScreen) {
    idScreen.innerText = getPluginLabel(pluginLabel, intl)
  }
}

// Nested keys overwrite top-level keys of the same name.
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

export const getDynamicKey = () => {
  return (+ new Date() + Math.floor(Math.random() * 999999)).toString(36)
}

// Replaces {<id>.OBJECT_ID} in wsPath with obj.
export const replaceFunc = (wsPath, id, obj) => {
  if (wsPath.indexOf(`{${id}.OBJECT_ID}`) >= 0) {
    wsPath = wsPath.replace(`{${id}.OBJECT_ID}`, obj)
    return wsPath
  } else {
    return wsPath
  }
}

export const convertBytes = (bytes, decimal) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimal)) + ' ' + sizes[i]
}

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

export const formatDateAndTime = (timestamp) => {
  const date = new Date(timestamp)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
  return formattedDateTime
}
