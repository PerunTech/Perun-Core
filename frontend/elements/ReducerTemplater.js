import React from 'react';
import createMergeReducer from '../model/mergeReducer';

export class ReducerTemplater extends React.Component {
  static generateReducerFromTemplate(templateName, id) {
    let templateBody = ''
    let retvalFunc = ''
    if (templateName !== null) {
      if (templateName === 'GenericGrid') {
        templateBody = this.gridTemplate(id)
        retvalFunc = new Function('state', 'action', templateBody)
      } else if (templateName === 'genericComponent') {
        retvalFunc = this.genericComponentTemplate(id)
      } else if (templateName === 'GenericForm') {
        templateBody = this.formTemplate(id)
        retvalFunc = new Function('state', 'action', templateBody)
      } else if (templateName === 'parameterComponent') {
        templateBody = this.parameterTemplate(id)
        retvalFunc = new Function('state', 'action', templateBody)
      } else {
        return null
      }
    }

    return retvalFunc
  }
  static genericComponentTemplate(id) {
    // Every <id>/... action's payload is merged into the state (model/mergeReducer.js).
    return createMergeReducer(id, {})
  }

  static gridTemplate(id) {
    const body =
      `${'  \'use strict\'; ' +
      ' if(state==null) state={}; ' +
      'let propName = action.id;  ' +
      '  ;' +
      '  if (propName == null || propName == undefined) { ' +
      '    propName = \'\' ;' +
      '  } ' +
      '  switch (action.type) {  ' +
      '    case  \''}${id}/PUBLISH_DATA': { ` +
      `        return Object.assign({}, state,action.payload)` +
      `    } ` +
      `    case  '${id}/FETCH_GRID_REJECTED': { ` +
      `        return Object.assign({}, state, {gridConfigLoaded: false, gridConfig: action.payload})` +
      `    } ` +
      `    case '${id}/FETCH_GRID_FULFILLED': { ` +
      `        return Object.assign({}, state, {gridConfigLoaded: true, gridConfig: action.payload})` +
      `    } ` +
      `    case '${id}/FETCH_GRID_DATA_FULFILLED': { ` +
      `        return Object.assign({}, state, {gridDataLoaded: true, gridData: action.payload, reloadGrid: false})` +
      `    } ` +
      `    case '${id}/FETCH_GRID_DATA_REJECTED': { ` +
      `        return Object.assign({}, state, {gridDataLoaded: false, gridData: action.payload})` +
      `    } ` +
      `    case '${id}/ROW_CLICKED': { ` +
      `        return Object.assign({}, state, {rowClicked: action.payload})` +
      `    } ` +
      `    case '${id}/INLINE_EDIT_FULFILLED':` +
      `    case '${id}/INLINE_EDIT_REJECTED': { ` +
      `        return Object.assign({}, state, {` +
      `        inlineSaveResult: action.payload,` +
      `        reloadGrid: true })` +
      `    } ` +
      `    case '${id}/INLINE_EDIT_RESET_STATE': { ` +
      `        return Object.assign({}, state, {` +
      `        inlineSaveResult: undefined })` +
      `    } ` +
      `    case '${id}/SAVE_ALL_RECORDS_FULFILLED':` +
      `    case '${id}/SAVE_ALL_RECORDS_REJECTED': { ` +
      `        return Object.assign({}, state, {` +
      `        saveAllResult: action.payload,` +
      `        reloadGrid: true })` +
      `    } ` +
      `    case '${id}/SAVE_ALL_RECORDS_RESET_STATE': { ` +
      `        return Object.assign({}, state, {` +
      `        saveAllResult: undefined })` +
      `    } ` +
      `     ` +
      ` ` +

      `  } ` +
      ` ` +
      `  return state`
    return body
  }

  static parameterTemplate(id) {
    const body =
      `${'  \'use strict\'; ' +
      ' if(state==null) state={}; ' +
      'let propName = action.id;  ' +
      '  ;' +
      '  if (propName == null || propName == undefined) { ' +
      '    propName = \'\' ;' +
      '  } ' +
      '  switch (action.type) {  ' +
      '    case  \''}${id}/PUBLISH_DATA': { ` +
      `        return Object.assign({}, state,action.payload)` +
      `    } ` +
      `    case  '${id}/FETCH_PARAMS_REJECTED': { ` +
      `      let isLoaded = 'paramConfigLoaded' ;` +
      `      let loadedData =  'paramConfig' ;` +
      `        return Object.assign({}, state, {[isLoaded]: false,[loadedData]: action.payload})` +
      `    } ` +
      `    case '${id}/FETCH_PARAMS_CONF_FULFILLED': { ` +
      `      let isLoaded = 'paramConfigLoaded' ;` +
      `      let loadedData =  'paramConfig' ;` +
      `        return Object.assign({}, state, {[isLoaded]: true,[loadedData]: action.payload})` +
      `    } ` +
      `    case '${id}/FETCH_PARAMS_CONF_REJECTED': { ` +
      `      let isLoaded = 'paramConfigLoaded' ;` +
      `      let loadedData = 'paramConfig' ;` +
      `        return Object.assign({}, state, {[isLoaded]: false,[loadedData]: action.payload})` +
      `    } ` +
      `     ` +
      ` ` +
      `  } ` +
      ` ` +
      `  return state`
    return body
  }

  static formTemplate(id) {
    const body =
      `${'  \'use strict\'; ' +
      ' if(state==null) state={}; ' +
      'let propName = action.id;  ' +
      '  ;' +
      '  if (propName == null || propName == undefined) { ' +
      '    propName = \'\' ;' +
      '  } ' +
      '  switch (action.type) { ' +
      '    case  \''}${id}/PUBLISH_DATA': { ` +
      `        return Object.assign({}, state,action.payload)` +
      `    } ` +
      `    case  '${id}/FETCH_FORM_FULFILLED': { ` +
      `        return Object.assign({}, state,{formConfigLoaded: true, formWithExcluded: action.payloadExcludedFields, formData: action.payload})` +
      `    } ` +
      `    case  '${id}/FETCH_FORM_REJECTED': { ` +
      `        return Object.assign({}, state,{formConfigLoaded: false, formWithExcluded: action.payloadExcludedFields, formData: action.payload})` +
      `    } ` +
      `    case  '${id}_tabledata/FETCH_FORM_TABLE_DATA_FULFILLED': { ` +
      `        return Object.assign({}, state,{formDataLoaded: true, formTableData: action.payload})` +
      `    } ` +
      `    case  '${id}_tabledata/FETCH_FORM_TABLE_DATA_REJECTED': { ` +
      `        return Object.assign({}, state,{formDataLoaded: false, formTableData: action.payload})` +
      `    } ` +
      `    case  '${id}_uischema/FETCH_FORM_UISCHEMA_FULFILLED': { ` +
      `        return Object.assign({}, state,{uischemaLoaded: true, uischema: action.payload})` +
      `    } ` +
      `    case  '${id}_uischema/FETCH_FORM_UISCHEMA_REJECTED': { ` +
      `        return Object.assign({}, state,{uischemaLoaded: false, uischema: action.payload})` +
      `    } ` +
      `     ` +
      ` ` +
      `  } ` +
      `  switch (action.type) {  ` +
      `    case  '${id}/SAVE_FORM_DATA': { ` +
      `        return Object.assign({}, state, { saveFormResponse: action.payload, saveFormError: undefined, saveFormType: action.resType, saveFormTitle: action.title, saveFormMessage: action.message })` +
      `    } ` +
      `     ` +
      ` ` +
      `  } ` +
      `  switch (action.type) {  ` +
      `    case  '${id}/REJECTED_FORM_DATA': { ` +
      `        return Object.assign({}, state, { saveFormResponse: undefined, saveFormError: action.payload })` +
      `    } ` +
      `     ` +
      ` ` +
      `  } ` +
      ` ` +
      `  return state`
    return body
  }
}
