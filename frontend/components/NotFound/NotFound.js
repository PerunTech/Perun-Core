import React, { useEffect } from 'react'
import { useIntl } from 'react-intl'
import { Link } from 'react-router-dom'
import { Icon } from '../../elements';

const NotFound = () => {
  const intl = useIntl()
  useEffect(() => {
    transformIdScreen()
  }, [])

  const transformIdScreen = () => {
    const idScreen = document.getElementById('identificationScreen')
    if (idScreen) {
      idScreen.innerText = intl.formatMessage({
        id: 'perun.main.not_found_title', defaultMessage: 'perun.main.not_found_title'
      })
    }
  }

  return (
    <div className='not-found-container'>
      <div className='not-found-content'>{<Icon name="IconAlertTriangle" />}</div>
      <p className='not-found-title'>
        {intl.formatMessage({ id: 'perun.main.not_found_title', defaultMessage: 'perun.main.not_found_title' })}
      </p>
      <p className='not-found-text'>
        {intl.formatMessage({ id: 'perun.main.not_found_text', defaultMessage: 'perun.main.not_found_text' })}
      </p>
      <Link to='/' className='not-found-btn'>
        {intl.formatMessage({ id: 'perun.main.not_found_btn', defaultMessage: 'perun.main.not_found_btn' })}
      </Link>
    </div>
  )
}

export default NotFound
