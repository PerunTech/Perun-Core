import React, { useEffect } from 'react'
import { Route } from 'react-router-dom'
import Logon from '../components/Logon/Logon'

const Landing = () => {
  useEffect(() => {
    localStorage.clear()
  }, [])

  return (
    <React.Fragment>
      <Route path='/home/:logonComp' render={props => <Logon {...props} />} />
    </React.Fragment>
  )
}

export default Landing
