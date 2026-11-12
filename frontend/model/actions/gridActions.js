import axios from 'axios'
import { svConfig } from '../../config';
import { isValidObject, isValidArray } from '..';

function getPath(gridid, url, session, params, gridType) {
  let axiosPath = ''
  switch (gridType) {
    case 'BASE':
      axiosPath = svConfig.triglavRestVerbs['BASE']
      break
    case 'BASE_DATA':
      axiosPath = svConfig.triglavRestVerbs['BASE_DATA']
      break
    case 'CUSTOM':
      axiosPath = svConfig.triglavRestVerbs[url]
      break
    case 'READ_URL':
      axiosPath = url
      break
    case 'SEARCH_GRID_DATA':
      axiosPath = url
      break
    default:
      axiosPath = url
  }

  axiosPath = svConfig.restSvcBaseUrl + axiosPath
  axiosPath = replaceParams(axiosPath, url, session, params)

  return axiosPath
}

function replaceParams(path, gridid, session, params) {
  path = path.replace('%gridName', gridid)
  path = path.replace('%session', session)
  for (let i = 0; i < params.length; i++) {
    const obj = params[i]
    const paramName = obj['PARAM_NAME']
    const paramValue = obj['PARAM_VALUE']

    path = path.replace('%' + paramName, paramValue)
  }
  return path
}

export function getGridConfig(gridid, gridName, session, params, gridType) {
  return function(dispatch) {
    if (gridType === 'SEARCH_GRID_DATA' && typeof gridName !== 'string') {
      dispatch({
        id: gridid,
        type: gridid + '/FETCH_GRID_FULFILLED',
        payload: gridName
      })
    } else {
      if (params === null || params === undefined) {
        params = []
      }

      const gridConfigPath = getPath(gridid, gridName, session, params, gridType)

      axios.get(gridConfigPath).then((response) => {
        let data = []
        if (isValidObject(response?.data, 1) || isValidArray(response?.data, 1)) {
          if (isValidArray(response.data?.data, 1)) {
            data = response.data.data
          } else {
            if (response?.data?.type && response?.data?.type?.toLowerCase() !== 'success') {
              dispatch({ id: gridid, type: gridid + '/FETCH_GRID_REJECTED', payload: { response: { data: response.data || '' } } })
              data = []
            } else {
              data = response.data
            }
          }
        }
        dispatch({
          id: gridid,
          type: gridid + '/FETCH_GRID_FULFILLED',
          payload: data
        })
      }).catch((err) => {
        dispatch({ id: gridid, type: gridid + '/FETCH_GRID_REJECTED', payload: err })
      })
    }
  }
}

export function getGridData(gridid, gridNameOrData, session, params, gridType) {
  return function(dispatch) {
    if (gridType === 'SEARCH_GRID_DATA' && typeof gridNameOrData !== 'string') {
      dispatch({
        id: gridid,
        type: gridid + '/FETCH_GRID_DATA_FULFILLED',
        payload: gridNameOrData
      })
    } else {
      if (gridType && gridType.toUpperCase() === 'BASE') {
        gridType = 'BASE_DATA'
      }
      if (params === null || params === undefined) {
        params = []
      }

      const gridConfig = getPath(gridid, gridNameOrData, session, params, gridType)

      axios.get(gridConfig).then((response) => {
        let data = []
        if (isValidObject(response?.data, 1) || isValidArray(response?.data)) {
          if (isValidArray(response.data?.data)) {
            data = response.data.data
          } else {
            if (response?.data?.type && response?.data?.type?.toLowerCase() !== 'success') {
              dispatch({ id: gridid, type: gridid + '/FETCH_GRID_DATA_REJECTED', payload: { response: { data: response.data || '' } } })
              data = []
            } else {
              data = response.data
            }
          }
        }
        dispatch({
          id: gridid,
          type: gridid + '/FETCH_GRID_DATA_FULFILLED',
          payload: data
        })
      }).catch((err) => {
        dispatch({ id: gridid, type: gridid + '/FETCH_GRID_DATA_REJECTED', payload: err })
      })
    }
  }
}

export function rowClicked(gridid, row, rowIdx) {
  return function(dispatch) {
    row['ROW_ID'] = rowIdx
    dispatch({ id: gridid, type: gridid + '/ROW_CLICKED', payload: row })
  }
}

export function lastSelectedItem(gridId, row, gridConfig) {
  return function(dispatch) {
    if (gridId && row) {
      dispatch({ type: 'ADD_LAST_SELECTED_ITEM', payload: [gridId, row, gridConfig] })
    } else if (gridId && !row) {
      if (gridId === 'resetState') {
        dispatch({ type: 'CLEAN_ALL_SELECTED_ITEMS', payload: undefined })
      } else {
        dispatch({ type: 'SWITCH_SELECTED_ITEM', payload: gridId })
      }
    }
  }
}

export function addGrid(gridid, grid, groupId) {
  return function(dispatch) {
    if (groupId === null || groupId === undefined) {
      groupId = 'grids'
    }
    dispatch({ type: 'ADDGRID', id: gridid, payload: grid, group: groupId })
  }
}

export function removeGrid(gridid, groupId) {
  return function(dispatch) {
    if (groupId == null) {
      groupId = 'grids'
    }
    dispatch({ type: 'REMOVEGRID', id: gridid, group: groupId })
  }
}
export function cleanGrids(groupId) {
  return function(dispatch) {
    if (groupId == null) {
      groupId = 'grids'
    }
    dispatch({ type: 'CLEAN_GRIDS', group: groupId })
  }
}

export function editRecordInline(session, onSaveMethodPath, jsonString, gridId) {
  return function(dispatch) {
    const restUrl = svConfig.restSvcBaseUrl + onSaveMethodPath
    axios({
      method: 'post',
      data: jsonString,
      url: restUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: gridId + '/INLINE_EDIT_FULFILLED', payload: response.data })
    }).catch((err) => {
      if (err.data) {
        dispatch({ type: gridId + '/INLINE_EDIT_REJECTED', payload: err })
      } else {
        console.log(err)
      }
    })
  }
}

export function saveAllRecords(session, saveAll, rows, gridId) {
  return function(dispatch) {
    const restUrl = svConfig.restSvcBaseUrl + saveAll
    axios({
      method: 'post',
      data: rows,
      url: restUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: gridId + '/SAVE_ALL_RECORDS_FULFILLED', payload: response.data })
    }).catch((err) => {
      dispatch({ type: gridId + '/SAVE_ALL_RECORDS_REJECTED', payload: err })
    })
  }
}

export function resetGridEditResponseState(gridId) {
  return function(dispatch) {
    dispatch({ type: gridId + '/INLINE_EDIT_RESET_STATE', payload: undefined })
    dispatch({ type: gridId + '/SAVE_ALL_RECORDS_RESET_STATE', payload: undefined })
  }
}

export function publishState(gridid, state) {
  return function(dispatch) {
    dispatch({ type: gridid + '/PUBLISH_DATA', payload: state })
  }
}

export function updateSelectedRows(selectedRows, gridId) {
  return function(dispatch) {
    dispatch({ type: 'UPDATE_SELECTED_GRID_ROWS', payload: [selectedRows, gridId] })
  }
}
