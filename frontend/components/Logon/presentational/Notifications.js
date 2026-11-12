import React, { useEffect, useReducer, useRef } from 'react'
import axios from 'axios'
import { alertUserResponse } from '../../../elements'

const Notifications = () => {
  const initialState = { notifications: [] }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ notifications }, setState] = useReducer(reducer, initialState)
  // Skips state updates after unmount.
  const componentIsMounted = useRef(true)

  useEffect(() => {
    getUserIp()
    return () => {
      componentIsMounted.current = false
    }
  }, [])

  const getNotifications = (userIp) => {
    const url = `${window.server}/PublicWs/getNotifications/${userIp}`
    axios.get(url).then(res => {
      if (res?.data?.data && Array.isArray(res.data.data)) {
        if (componentIsMounted.current) {
          setState({ notifications: res.data.data })
        }
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err })
    })
  }

  const getUserIp = () => {
    const url = 'https://api.ipify.org?format=json'
    axios.get(url).then(res => {
      if (res?.data?.ip) {
        getNotifications(res.data.ip)
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err })
    })
  }

  return (
    <div className='notifications'>
      {notifications.length > 0 && notifications.map((notification, i) => {
        return (
          <p key={i}>
            <b>{`${notification.TITLE}`}</b><br /><br /><p>{`${notification.MESSAGE}`}</p>
          </p>
        )
      })}
    </div>
  )
}

export default Notifications
