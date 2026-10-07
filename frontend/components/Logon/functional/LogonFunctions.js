import React from 'react'
import PropTypes from 'prop-types'
import axios from 'axios';
import * as utils from '../utils'
import * as config from '../../../config/config.js'
import { alertUserResponse, alertUserV2 } from '../../../elements';
import Loading from '../../Loading/Loading'
import { isValidObject } from '../../../functions/utils';

export default function LogonFunctions(TargetComponent, validationString, method, onSubmit) {
  class WrappedComponent extends React.Component {
    static propTypes = {
      status: PropTypes.string,
      title: PropTypes.string,
      message: PropTypes.string,
      configuration: PropTypes.object
    }
    constructor(props) {
      super(props)
      this.state = {
        username: '',
        idNo: '',
        eMail: '',
        password: '',
        repeatPassword: '',
        loading: false,
        farmer: false,
        showFarmReg: true,
        showUserReg: false,
        showSsoLoginBtn: false,
        errors: {},
        alert: undefined
      }
    }

    componentDidMount() {
      if (this.props?.configuration?.data) {
        const configuration = this.props.configuration.data || undefined
        if (configuration.sso_config && isValidObject(configuration.sso_config, 1)) {
          this.setState({ showSsoLoginBtn: true })
        }
      }
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
      if (nextProps.status) {
        let statusType = nextProps?.status?.toLowerCase() || 'info'
        if (statusType === 'exception') { statusType = 'error' }
        alertUserResponse({ type: statusType, response: nextProps })
      }
      if (nextProps.configuration) {
        const statusType = nextProps?.configuration?.type?.toLowerCase() || 'info'
        if (statusType !== 'success') {
          alertUserResponse({ type: statusType, response: nextProps.configuration })
        }
      }
    }

    onSubmit = (e) => {
      const configuration = this.props.configuration.data
      const methodType = configuration[method].methodtype
      let formData
      let webService
      const errors = utils.validateOnSubmit(e, this.state, validationString)
      if (!errors) {
        if (methodType === 'POST') {
          formData = utils.createFormDataFromStateParams(this.state)
          webService = configuration[method].submit
        } else {
          webService = utils.createWebServiceFromStateParams(this.state, configuration[method].submit)
        }
        const restUrl = config.svConfig.restSvcBaseUrl + webService
        this.props[onSubmit](restUrl, methodType, formData)
      } else {
        this.setState({ errors })
      }
    }

    onChange = (e) => {
      // dynamically change component and field state, depending on user input
      const newState = utils.resetValidateOnChange(e, this.state)
      this.setState({ [e.target.name]: newState.newKeyVal[e.target.name], errors: newState.errors })
    }

    onChangeFarmer = (value) => {
      this.setState({ farmer: value })
    }

    onSamlSubmit = () => {
      const configuration = this.props.configuration.data
      if (configuration.sso_config && isValidObject(configuration.sso_config, 1)) {
        const ssoConfig = configuration.sso_config
        const ssoFormKey = ssoConfig.SSO_FORM_KEY
        const ssoFormValue = ssoConfig.SSO_FORM_VALUE
        const ssoMethod = ssoConfig.SSO_METHOD
        const ssoUrl = ssoConfig.SSO_URL
        this.setState({ loading: true })
        axios.get(`${window.server}${ssoFormValue}`).then(res => {
          this.setState({ loading: false })
          if (res.data) {
            const token = res.data
            utils.submitForm(ssoUrl, ssoMethod, { [ssoFormKey]: token })
          }
        }).catch(err => {
          console.error(err)
          this.setState({ loading: false })
          alertUserResponse({ response: err })
        })
      } else {
        alertUserV2({ type: 'info', title: 'Missing SSO configuration', message: 'Please contact your IT administrator' })
      }
    }

    render() {
      const isEverythingLoaded = utils.displayLoader(this.props, method)
      return <React.Fragment>
        {!isEverythingLoaded && <Loading />}
        {this.state.loading && <Loading />}
        <TargetComponent
          internalComponentState={this.state}
          {...this.props}
          context={this.context}
          onSubmit={this.onSubmit}
          onSamlSubmit={this.onSamlSubmit}
          showSsoLoginBtn={this.state.showSsoLoginBtn}
          onChange={this.onChange}
          onChangeFarmer={this.onChangeFarmer}
        />
      </React.Fragment>
    }
  }

  TargetComponent.contextTypes = {
    intl: PropTypes.object.isRequired
  }

  return WrappedComponent
}
