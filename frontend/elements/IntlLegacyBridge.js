import React from 'react'
import PropTypes from 'prop-types'
import { useIntl } from 'react-intl'

// Republishes the modern react-intl context as legacy React context, so components
// (in this repo and in dependent projects) that still read `context.intl` via
// `contextTypes = { intl: PropTypes.object }` keep working unchanged.
class LegacyIntlContextBridge extends React.Component {
  static childContextTypes = {
    intl: PropTypes.object
  }

  getChildContext() {
    return { intl: this.props.intl }
  }

  render() {
    return this.props.children
  }
}

LegacyIntlContextBridge.propTypes = {
  intl: PropTypes.object.isRequired,
  children: PropTypes.node
}

export default function IntlLegacyBridge({ children }) {
  const intl = useIntl()
  return <LegacyIntlContextBridge intl={intl}>{children}</LegacyIntlContextBridge>
}

IntlLegacyBridge.propTypes = {
  children: PropTypes.node
}
