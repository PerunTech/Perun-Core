import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { IntlProvider } from 'react-intl'

// react-intl's provider, fed from the store's `intl` slice (model/reducers/intlReducer.js).
// Keyed by the locale, as react-intl-redux's was, so a language switch remounts everything under
// it rather than leaving components holding labels formatted in the old one.
export default function IntlStoreProvider({ children }) {
  const intl = useSelector(state => state.intl)
  return <IntlProvider key={intl.locale} {...intl}>{children}</IntlProvider>
}

IntlStoreProvider.propTypes = {
  children: PropTypes.node
}
