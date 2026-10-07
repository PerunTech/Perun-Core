import React from 'react'
import PropTypes from 'prop-types'
import { createHashHistory } from 'history'
import { alertUserResponse } from '../../../elements';
import LogonActions from '../functional/LogonActions'
import Loading from '../../Loading/Loading'
import * as utils from '../utils'
import * as config from '../../../config/config.js'

class ActivateUser extends React.Component {
  static propTypes = {
    status: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    activateUser: PropTypes.func.isRequired,
    configuration: PropTypes.object
  }

  constructor(props) {
    super(props)
    const uuid = utils.getURLParameterByName('uuid', window.location.href)
    this.state = {
      uuid: uuid,
      alert: null
    }
    this.activateUser = this.activateUser.bind(this)
    this.hashHistory = createHashHistory()
  }

  componentDidMount() {
    if (this.props.configuration) {
      this.activateUser(this.props.configuration.data)
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextConfiguration = nextProps.configuration
    if (nextProps.status) {
      let statusType = nextProps?.status?.toLowerCase() || 'info'
      if (statusType === 'exception') { statusType = 'error' }
      alertUserResponse({ type: statusType, response: nextProps })
    }
    if (!this.props.configuration && nextConfiguration && this.props.configuration !== nextConfiguration) {
      if (nextConfiguration.data.activateUser1 || nextConfiguration.data.activateUser) {
        this.activateUser(nextConfiguration.data)
      }
    }
    if (nextProps.configuration) {
      const statusType = nextProps?.configuration?.type?.toLowerCase() || 'info'
      if (statusType !== 'success') {
        alertUserResponse({ type: statusType, response: nextProps.configuration })
      }
    }
  }

  activateUser(configuration) {
    const method = configuration.activateUser1.methodtype
    let formData
    let webService
    if (method === 'POST') {
      formData = utils.createFormDataFromStateParams(this.state)
      webService = configuration.activateUser1.submit
    } else {
      webService = utils.createWebServiceFromStateParams(this.state, configuration.activateUser.submit)
    }
    const restUrl = config.svConfig.restSvcBaseUrl + webService
    this.props.activateUser(restUrl, method, formData)
  }

  render() {
    return (this.state.alert || <Loading />)
  }
}

export default LogonActions(ActivateUser)
