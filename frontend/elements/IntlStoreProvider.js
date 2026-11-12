import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { IntlProvider } from 'react-intl'

// Keyed by the locale, so a language switch remounts everything under it.
export default function IntlStoreProvider({ children }) {
  const intl = useSelector(state => state.intl)
  return <IntlProvider key={intl.locale} {...intl}>{children}</IntlProvider>
}

IntlStoreProvider.propTypes = {
  children: PropTypes.node
}
