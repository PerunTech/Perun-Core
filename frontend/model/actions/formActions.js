import axios from 'axios';
import { svConfig } from '../../config';
import { store, cloneObject, isValidObject } from '..';

export function getFormData(id, reduxKey, formName, uiSchema, formTableData, session, params) {
  let verbPath
  if (params === 'FORM_DATA' && typeof formName !== 'string') {
    store.dispatch({
      id: id,
      type: id + '/FETCH_FORM_FULFILLED',
      payload: formName,
      payloadExcludedFields: cloneObject(formName),
    })
  } else {
    if (params === 'READ_URL') {
      verbPath = replaceParams(formName, '', session, params)
    } else {
      if (params) {
        verbPath = svConfig.triglavRestVerbs[formName] || formName
        verbPath = replaceParams(verbPath, formName, session, params)
      }
    }

    const restUrl = svConfig.restSvcBaseUrl + (verbPath || formName)
    axios.get(restUrl).then((response) => {
      let data = {}
      if (isValidObject(response?.data, 1)) {
        if (isValidObject(response.data.data, 1)) {
          data = response.data.data
        } else {
          data = response.data
        }
      }
      store.dispatch({
        id: id,
        type: id + '/FETCH_FORM_FULFILLED',
        payload: data,
        payloadExcludedFields: cloneObject(data),
      })
    }).catch((err) => {
      store.dispatch({ id: id, type: id + '/FETCH_FORM_REJECTED', payload: err })
    })
  }

  getUiSchema(id + '_uischema', reduxKey + '_uischema', uiSchema, session, params)
  getDataTableForm(id + '_tabledata', reduxKey + '_tabledata', formTableData, session, params)
}

function getUiSchema(id, reduxKey, uiSchema, session, params) {
  let verbPath
  if (params === 'FORM_DATA' && typeof uiSchema !== 'string') {
    store.dispatch({
      id: id,
      type: id + '/FETCH_FORM_UISCHEMA_FULFILLED',
      payload: uiSchema
    })
  } else {
    if (params === 'READ_URL') {
      verbPath = replaceParams(uiSchema, '', session, params)
    } else {
      if (params) {
        verbPath = svConfig.triglavRestVerbs[uiSchema] || uiSchema
        verbPath = replaceParams(verbPath, uiSchema, session, params)
      }
    }

    const restUrl = svConfig.restSvcBaseUrl + (verbPath || uiSchema)
    axios.get(restUrl).then((response) => {
      let data
      if (isValidObject(response?.data)) {
        if (isValidObject(response.data.data)) {
          data = response.data.data
        } else {
          data = response.data
        }
      }
      store.dispatch({
        id: id,
        type: id + '/FETCH_FORM_UISCHEMA_FULFILLED',
        payload: data
      })
    }).catch((err) => {
      store.dispatch({ id: id, type: id + '/FETCH_FORM_UISCHEMA_REJECTED', payload: err })
    })
  }
}

function getDataTableForm(id, reduxKey, formTableData, session, params) {
  let verbPath
  if (params === 'FORM_DATA' && typeof formTableData !== 'string') {
    store.dispatch({
      id: id,
      type: id + '/FETCH_FORM_TABLE_DATA_FULFILLED',
      payload: formTableData
    })
  } else {
    if (params === 'READ_URL') {
      verbPath = replaceParams(formTableData, '', session, params)
    } else {
      if (params) {
        verbPath = svConfig.triglavRestVerbs[formTableData] || formTableData
        verbPath = replaceParams(verbPath, formTableData, session, params)
        // 'FORM_DATA' with the table data given as a URL comes here too, and has no parameters to check
        if (Array.isArray(params)) {
          for (let i = 0; i < params.length; i++) {
            let obj = params[i]
            if (!obj.PARAM_VALUE) {
              // there are some missing parameters, exit function
              console.warn('Missing parameter ' + obj.PARAM_NAME)
            }
          }
        }
      }
    }
    const restUrl = svConfig.restSvcBaseUrl + (verbPath || formTableData)
    axios.get(restUrl).then((response) => {
      let data
      if (isValidObject(response?.data)) {
        if (isValidObject(response.data.data)) {
          data = response.data.data
        } else {
          data = response.data
        }
      }
      store.dispatch({
        id: id,
        type: id + '/FETCH_FORM_TABLE_DATA_FULFILLED',
        payload: data
      })
    }).catch((err) => {
      store.dispatch({ id: id, type: id + '/FETCH_FORM_TABLE_DATA_REJECTED', payload: err })
    })
  }
}

export function saveFormData(id, formName, session, formData, dbParamsProvided) {
  let verbPath = formName
  if (!dbParamsProvided) {
    // get parameters from config file, if no such are provided from database
    verbPath = svConfig.triglavRestVerbs[formName]
    verbPath = replaceParams(verbPath, formName, session, formData)
  }
  const restUrl = svConfig.restSvcBaseUrl + verbPath
  // GPE 25.05.2017 Get the jsonString value from the formData
  let valueToSend = ''
  for (let i = 0; i < formData.length; i++) {
    let obj = formData[i]
    if (obj.PARAM_NAME === 'jsonString') {
      valueToSend = obj.PARAM_VALUE
    }
  }
  // Send only the jsonString value in the content body
  axios({
    method: 'post',
    data: valueToSend,
    url: restUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then((response) => {
    let payload
    if (response.data.type && response.data.title && response.data.message) {
      if (response.data.type === 'SUCCESS' || response.data.type === 'INFO' || response.data.type === 'WARNING') {
        store.dispatch({
          id: id,
          type: id + '/SAVE_FORM_DATA',
          payload: response.data.data,
          resType: response.data.type,
          title: response.data.title,
          message: response.data.message
        })
      } else if (response.data.type === 'ERROR' || response.data.type === 'EXCEPTION') {
        store.dispatch({ id: id, type: id + '/REJECTED_FORM_DATA', payload: { title: response.data.title, message: response.data.message } })
      }
    } else {
      payload = response.data
      store.dispatch({ id: id, type: id + '/SAVE_FORM_DATA', payload: payload })
    }
  }).catch((err) => {
    store.dispatch({ id: id, type: id + '/REJECTED_FORM_DATA', payload: err })
  })
}

export function saveFormDataWithFile(id, formName, session, formData, fileToUpload, params) {
  let verbPath = svConfig.triglavRestVerbs[formName]
  verbPath = replaceParams(verbPath, formName, session, params)
  let valueToSend = ''
  const restUrl = svConfig.restSvcBaseUrl + verbPath
  valueToSend = formData.formData
  const data = new FormData()
  data.append('data', JSON.stringify(valueToSend))
  data.append('file', fileToUpload)
  // GPE 25.05.2017 Get the jsonString value from the formDat
  // Send only the jsonString value in the content body
  axios.post(restUrl, data).then((response) => {
    store.dispatch({ id: id, type: id + '/SAVE_FORM_DATA', payload: response.data })
  }).catch((err) => {
    store.dispatch({ id: id, type: id + '/REJECTED_FORM_DATA', payload: err })
  })
}

export function saveFormDataWithGeometry(id, formName, session, formData, params, polygon) {
  let verbPath = svConfig.triglavRestVerbs[formName]
  verbPath = replaceParams(verbPath, formName, session, params)
  let valueToSend = formData
  if (polygon !== null && polygon !== undefined) {
    valueToSend['multypolygeometry'] = polygon
  }
  const restUrl = svConfig.restSvcBaseUrl + verbPath
  // Send only the jsonString value in the content body
  axios({
    method: 'post',
    data: JSON.stringify(valueToSend),
    url: restUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then((response) => {
    store.dispatch({ id: id, type: id + '/SAVE_FORM_DATA', payload: response.data })
  }).catch((err) => {
    store.dispatch({ id: id, type: id + '/REJECTED_FORM_DATA', payload: err })
  })
}

function replaceParams(path, formName, session, params) {
  // replace base params like session and gridName
  path = path.replace('%gridName', formName)
  path = path.replace('%session', session)
  // replace custom params
  for (let i = 0; i < params.length; i++) {
    const obj = params[i]
    const paramName = obj['PARAM_NAME']
    const paramValue = obj['PARAM_VALUE']

    path = path.replace('%' + paramName, paramValue)
  }
  return path
}
