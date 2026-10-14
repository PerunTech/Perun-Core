import React from 'react'
import { useIntl } from 'react-intl'
import Announcement from './Announcement'
import Notifications from './Notifications'

const Announcements = () => {
  const intl = useIntl()
  return (
    <div id='main' className='flex'>
      <div className='container-left'>
        <h4 style={{ color: 'black', borderBottom: '3px solid #e8b763' }}>
          {intl.formatMessage({ id: 'perun.login.announcements', defaultMessage: 'perun.login.announcements' })}
        </h4>
        <Notifications />
      </div>
      <div className='container-right'>
        <h4 style={{ color: 'black', borderBottom: '3px solid #e8b763' }}>
          {intl.formatMessage({ id: 'perun.main.guides', defaultMessage: 'perun.main.guides' })}
        </h4>
        <Announcement />
      </div>
    </div>
  )
}

export default Announcements
