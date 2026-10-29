import axios from 'axios';
import a from '../actionNames.json';
import { svSessionRegxp } from '..';
import { switchServerLanguage } from '../utils';
import { currentLanguage } from '../../functions/language'

export function loginUser(restUrl, method, formData, customData) {
  return function (dispatch) {
    dispatch({ type: a.loginPending, payload: undefined })
    // make the call
    if (customData) {
      dispatch({ type: a.loginCustom, payload: customData })
    } else {
      axios({
        method: method,
        url: restUrl,
        data: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }).then((response) => {
        if (svSessionRegxp(response?.data?.data?.token)) {
          dispatch({ type: a.loginFulfilled, payload: response.data })
          switchServerLanguage(currentLanguage(), response.data.data.token)
        } else {
          dispatch({ type: a.loginRejected, payload: response?.data })
        }
      }).catch((error) => {
        // error
        const title = error.response?.data?.title || error
        const message = error.response?.data?.title || ''
        dispatch({ type: a.loginRejected, payload: { type: 'error', title, message } })
      })
    }
  }
}

export function registerUser(restUrl, method, formData) {
  return function (dispatch) {
    dispatch({ type: a.registerPending, payload: undefined })
    // make the call
    axios({
      method: method,
      url: restUrl,
      data: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: a.registerFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.registerRejected, payload: { type: 'error', title, message } })
    })
  }
}

export function recoverPassword(restUrl, method, formData) {
  return function (dispatch) {
    dispatch({ type: a.recoverPassPending, payload: undefined })
    // make the call
    axios({
      method: method,
      url: restUrl,
      data: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: a.recoverPassFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.recoverPassRejected, payload: { type: 'error', title, message } })
    })
  }
}

export function changePassword(restUrl, method, formData) {
  return function (dispatch) {
    dispatch({ type: a.changePassPending, payload: undefined })
    // make the call
    axios({
      method: method,
      url: restUrl,
      data: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: a.changePassFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.changePassRejected, payload: { type: 'error', title, message } })
    })
  }
}

export function changeEmail(restUrl, method, formData) {
  return function (dispatch) {
    dispatch({ type: a.changeEmailPending, payload: undefined })
    // make the call
    axios({
      method: method,
      url: restUrl,
      data: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: a.changeEmailFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.changeEmailRejected, payload: { type: 'error', title, message } })
    })
  }
}

export function activateUser(restUrl, method, formData) {
  return function (dispatch) {
    dispatch({ type: a.activateUserPending, payload: undefined })
    // make the call
    axios({
      method: method,
      url: restUrl,
      data: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: a.activateUserFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.activateUserRejected, payload: { type: 'error', title, message } })
    })
  }
}

export function activateLink(restUrl, method, formData) {
  return function (dispatch) {
    dispatch({ type: a.activateUserPending, payload: undefined })
    // make the call
    axios({
      method: method,
      url: restUrl,
      data: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then((response) => {
      dispatch({ type: a.activateUserFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.activateUserRejected, payload: { type: 'error', title, message } })
    })
  }
}

export function logoutUser(restUrl) {

  return function (dispatch) {
    dispatch({ type: 'RESET_USER_DATA' })
    dispatch({ type: a.logoutUserPending, payload: undefined })
    // make the call
    axios.get(restUrl).then((response) => {
      dispatch({ type: a.logoutUserFulfilled, payload: response.data })
    }).catch((error) => {
      // error
      const title = error.response?.data?.title || error
      const message = error.response?.data?.title || ''
      dispatch({ type: a.logoutUserRejected, payload: { type: 'error', title, message } })
    })
  }
}
