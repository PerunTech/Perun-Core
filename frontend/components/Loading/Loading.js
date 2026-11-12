import React, { useContext } from 'react'
import { IntlContext } from 'react-intl'

// Reads the context, not useIntl(), which throws outside the provider: client.js renders this before
// <App />, so there is no text until the labels are in.
const Loading = () => {
  const intl = useContext(IntlContext)
  return (
    <div className='fade-wrapper'>
      <div className='loadd'>
        <div className='loader-text'>
          {intl?.formatMessage({ id: 'perun.main.loading', defaultMessage: 'perun.main.loading' })}
        </div>
        <div className='bar' />
      </div>
    </div>
  )
}

export default Loading
