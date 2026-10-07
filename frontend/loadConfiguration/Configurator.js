import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { store } from '../model'
import { Loading } from '../components/ComponentsIndex'
import { loadConfiguration } from './loadConfiguration'

/**
 * Component configuration wrapper- provides the wrapped component with the requested configuration.
 * When the wrapper is mounted, it dispatches the loadConfiguration function,
 * which gets the configuration type from the DB- defined by the 'type' prop.
 * After the configuration has been loaded, the reducing function writes it in the store 'configurator' object.
 * The said configuration can be accessed through the 'configuration prop in the wrapped component.'
 */
class _Configurator extends React.Component {
  /**
   * Default constructor.
   * MANDATORY PARAMETERS
   * @param {string} type - Type of configuration required by the web service
   *
   * OPTIONAL PARAMETERS
   * @param {string} configPath - Class path to the web service which proveides the component configuration
   * 
   * IMPORTED FUNCTIONS
   * @param {function} loadConfiguration - Dispatch the action to get the configuration 
   */
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
    /* Note: this method of sending props will only work if there is a single child,
    and it is a valid React element. In other cases, use React.Children.map */
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