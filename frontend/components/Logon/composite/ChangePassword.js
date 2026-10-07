import React from 'react'
import PropTypes from 'prop-types'
import { alertUserResponse, InputElement } from '../../../elements';
import LogonActions from '../functional/LogonActions'
import Loading from '../../Loading/Loading'
import { Link } from 'react-router-dom'
import * as utils from '../utils'
import * as config from '../../../config/config.js'
import { createHashHistory } from 'history'
import { getCapsLockState } from '../../../functions/utils';

class ChangePassword extends React.Component {
  static propTypes = {
    status: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    changePassword: PropTypes.func.isRequired,
    configuration: PropTypes.object
  }
  constructor(props) {
    super(props)
    const username = utils.getURLParameterByName('username', window.location.href)
    const recoverToken = utils.getURLParameterByName('recoveryToken', window.location.href)
    this.state = {
      username: username,
      idNo: '',
      password: '',
      repeatPassword: '',
      recoverToken: recoverToken,
      errors: {},
      alert: undefined,
      capsLockOn: false
    }
    this.hashHistory = createHashHistory()
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
    const method = configuration.changePassword.methodtype
    let formData
    let webService
    const errors = utils.validateOnSubmit(e, this.state, 'CHANGE_PASS')
    if (!errors) {
      if (method === 'POST') {
        formData = utils.createFormDataFromStateParams(this.state)
        webService = configuration.changePassword.submit
      } else {
        webService = utils.createWebServiceFromStateParams(this.state, configuration.changePassword1.submit)
      }
      const restUrl = config.svConfig.restSvcBaseUrl + webService
      this.props.changePassword(restUrl, method, formData)
    } else {
      this.setState({ errors })
    }
  }

  setCapsLockState = (isActive) => {
    this.setState({ capsLockOn: isActive })
  }

  onChange = (e) => {
    // dynamically change component and field state, depending on user input
    const newState = utils.resetValidateOnChange(e, this.state)
    this.setState({ [e.target.name]: newState.newKeyVal[e.target.name], errors: newState.errors })
  }

  redirectOnSuccess = (statusType) => {
    if (statusType === 'success') {
      this.hashHistory.push('/home/login')
    }
  }

  render() {
    const { alert, errors, username, idNo, password, repeatPassword, recoverToken, capsLockOn } = this.state
    const labels = this.context.intl
    let component = null
    let isEverythingLoaded = utils.displayLoader(this.props, 'changePassword1')
    if (!username || !recoverToken) {
      this.hashHistory.push('/home/login')
    } else if (isEverythingLoaded) {
      component = <div className='change-password-container'>
        <form id='submit_form' className='perun-core-form fadeIn customForm' onSubmit={this.onSubmit}>
          {alert}
          <h4 className='title-change-password'>
            {labels.formatMessage({
              id: `${config.labelBasePath}.login.e_app_recover_pass_title`,
              defaultMessage: `${config.labelBasePath}.login.e_app_recover_pass_title`
            })}
          </h4>
          <InputElement
            id='pinChPass'
            name='username'
            value={username}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.user_name`,
              defaultMessage: `${config.labelBasePath}.login.user_name`
            })}
            label='username'
            error={errors.username}
            type='text'
            onChange={this.onChange}
          />
          <InputElement
            id='idNoChPass'
            name='idNo'
            value={idNo}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.pin`,
              defaultMessage: `${config.labelBasePath}.login.pin`
            })}
            label='idNo'
            error={errors.idNo}
            type='text'
            onChange={this.onChange}
            maxlength={13}
          />
          <InputElement
            id='passChPass'
            name='password'
            value={password}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.new_password`,
              defaultMessage: `${config.labelBasePath}.login.new_password`
            })}
            type='password'
            label='password'
            onChange={this.onChange}
            error={errors.password}
          />
          <InputElement
            id='repeatChPass'
            name='repeatPassword'
            value={repeatPassword}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.repeat_password`,
              defaultMessage: `${config.labelBasePath}.login.repeat_password`
            })}
            label='repeatPassword'
            error={errors.repeatPassword}
            type='password'
            onChange={this.onChange}
            onKeyUp={(event) => getCapsLockState(event, this.setCapsLockState)}
          />
          {capsLockOn && (
            <p className='caps-lock-is-active'>
              {labels.formatMessage({
                id: `${config.labelBasePath}.admin_console.caps_lock_active`,
                defaultMessage: `${config.labelBasePath}.admin_console.caps_lock_active`
              })}
            </p>
          )}
          <button id='changepass_submit' type='submit' className='btn button-action button-hover' style={{ 'marginTop': '1rem' }}>
            <span>{labels.formatMessage({
              id: `${config.labelBasePath}.login.create_password`,
              defaultMessage: `${config.labelBasePath}.login.create_password`
            })}</span>
          </button>
          <div style={{ 'marginTop': '0.5rem' }}>
            <Link to='/home/login' className='link-default link-logon'>
              {labels.formatMessage({
                id: `${config.labelBasePath}.login.back_login_form`,
                defaultMessage: `${config.labelBasePath}.login.back_login_form`
              })}
            </Link>
          </div>
        </form>
      </div>
    } else {
      component = <Loading />
    }
    return (component)
  }
}

ChangePassword.contextTypes = {
  intl: PropTypes.object.isRequired
}

export default LogonActions(ChangePassword)
