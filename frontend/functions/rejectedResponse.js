import axios from 'axios'
import { createHashHistory } from 'history'
import { store } from '../model'
import { alertUserResponse, alertUserV2 } from '../elements/util/alertUserV2'
import { markReported } from './reportedErrors'

// Every failure rejects; 302, 401, 502 and 503 are answered here and marked, so alertUserResponse stays quiet.
// axios-retry passes a retried request's error through a second time, hence answered.
const answered = new WeakSet()

export function rejectedResponse(error) {
  if (answered.has(error)) return Promise.reject(error)
  answered.add(error)
  if (!error.response) {
    if (!axios.isCancel(error)) {
      alertUserV2({ type: 'error', title: 'Unable to connect to the server', message: 'Please try again later' })
    }
    return Promise.reject(error)
  }
  switch (error.response.status) {
    case 302:
      alertUserV2({ type: 'info', title: 'The server responded with a status code 302 Found' })
      break;
    case 401:
      createHashHistory().push('/home/login')
      alertUserResponse({ response: error.response })
      store.dispatch({ type: 'LOGOUT_FULFILLED', payload: undefined })
      break;
    case 502:
    case 503:
      alertUserV2({ type: 'info', title: 'The server is temporarily down for maintenance', message: 'Please try again soon' })
      break;
    default:
      return Promise.reject(error);
  }
  markReported(error)
  return Promise.reject(error)
}
