import React, { useContext } from 'react'
import { IntlContext } from 'react-intl'

// progress bar
// Reads the context rather than useIntl(), which throws without a provider: client.js renders this
// before <App />, outside the IntlProvider, so there is no text until the labels are in.
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
