import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { store } from '../model'
import { Loading } from '../components/ComponentsIndex'
import { loadConfiguration } from './loadConfiguration'

// Loads the configuration of the given type and hands it to its child as `configuration`.
class _Configurator extends React.Component {
  constructor(props) {
    super(props)
    this.state = { isFetching: false }
  }

  componentDidMount() {
    this.setState({ isFetching: true })
    loadConfiguration(this.props.type, this.props.configPath)
    store.dispatch({ type: 'RESET_ACTIVE_MODULE_MENU_ITEM' })
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.type !== nextProps.type || this.props.configPath !== nextProps.configPath) {
      this.setState({ isFetching: true })
      loadConfiguration(nextProps.type, nextProps.configPath)
    }
    if (nextProps.configuration && this.props.configuration !== nextProps.configuration) {
      this.setState({ isFetching: false })
    }
  }

  render() {
    // Only for a single element child.
    const children = React.cloneElement(this.props.children, { configuration: this.props.configuration })
    if (this.state.isFetching) {
      return <Loading />
    } else {
      return <div className={(children.key && children.key === 'LoginForm') ? 'holder-login-screen' : this.props.svSession ? 'holder-components-auth' : 'holder-components'}>
        {children}
      </div>
    }
  }
}

const mapStateToProps = (state, ownProps) => {
  let configuration
  if (state.configurator.configuration) {
    if (state.configurator.configuration[ownProps.type]) {
      configuration = state.configurator.configuration[ownProps.type]
    }
  }
  return ({ configuration: configuration, svSession: state.security.svSession })

}

_Configurator.propTypes = {
  configuration: PropTypes.object,
  type: PropTypes.string,
  configPath: PropTypes.string
}

export const Configurator = connect(mapStateToProps)(_Configurator)