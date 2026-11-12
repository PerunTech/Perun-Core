import axios from 'axios';
import React from 'react';
import axiosRetry from 'axios-retry';

import { store } from '.';
import { svConfig } from '../config';
import { wasReported } from '../functions/reportedErrors';

axiosRetry(axios, { retries: 1 })

export function busyToFalse(reducer, verb) {
  return {
    type: `${reducer}/${verb}_ACTION_IS_NOW_FALSE`,
    overrideStatus: true,
    payload: {
      isBusy: false
    }
  }
}

export function dataToRedux(callback, reducer, reduxKey, verb, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17) {
  const args = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17]
  store.dispatch(dataToReduxMain(callback, reducer, reduxKey, verb, ...args))
}

export function dataToReduxMain(callback, reducer, reduxKey, verb, ...args) {
  let verbPath = svConfig.triglavRestVerbs[verb]
  let request = null
  let isNotRestCall = null
  let isPending = true
  let isFullState = false

  if (!verbPath) {
    isNotRestCall = verb
  } else {
    for (let i = 0; i < args.length; i++) {
      verbPath = verbPath.replace(`%s${i + 1}`, args[i])
    }
  }

  const restUrl = svConfig.restSvcBaseUrl + verbPath
  if (reduxKey === 'FULL_STATE') { isFullState = true }

  if (isNotRestCall === null) {
    request = axios.get(restUrl, { timeout: 10000 }).then((response) => {
      store.dispatch(busyToFalse(reducer, verb))
      if (callback instanceof Function && !(response?.data instanceof Error)) {
        callback(response?.data)
      }
      return response?.data
    }).catch((error) => {
      store.dispatch(busyToFalse(reducer, verb))
      // Already shown to the user. The callback still gets undefined, so the label load at boot
      // goes on to render the app.
      if (wasReported(error)) {
        if (callback instanceof Function) callback(undefined)
        return undefined
      }
      console.log('Error', error.message)
      // Lets the app go on loading after a refresh.
      if (verb === 'MAIN_VALIDATE' && callback instanceof Function) {
        callback(error)
      }

      throw new Error(error)
    })
  }

  // An unknown verb is data, dispatched without a request.
  if (isNotRestCall !== null) {
    request = isNotRestCall
    // Or the app would wait forever.
    isPending = false
    // So the action type reads well in DevTools.
    verb = 'PURE_DATA_FOR_' + reduxKey
  }
  let payload = {}
  if (isFullState && reducer !== null) {
    const obj = {}
    for (const key in request) {
      if (key !== 'dispatch' && key !== 'authData' && key !== 'children') {
        const value = request[key]
        if (!(value instanceof React.Component) && !(typeof value === 'function')) { obj[key] = value }
      }
    }
    obj['isBusy'] = isPending
    payload = obj
  } else {
    payload = {
      [reduxKey]: request,
      isBusy: isPending
    }
  }

  // Only isBusy while the labels load.
  if (verb === 'MAIN_LABELS') {
    payload = {
      isBusy: isPending
    }
  }

  return {
    type: `${reducer}/${verb}`,
    payload
  }
}
