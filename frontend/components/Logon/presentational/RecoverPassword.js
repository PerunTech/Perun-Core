import React from 'react'
import { Link } from 'react-router-dom'
import LogonActions from '../functional/LogonActions'
import LogonFunctions from '../functional/LogonFunctions'
import { InputElement } from '../../../elements';
import * as config from '../../../config/config.js'

const RecoverPassword = (props, context) => {
  const { alert, errors, username } = props.internalComponentState
  const { onSubmit, onChange } = props
  const labels = context.intl
  return (
    <div className='linkFormHolder'>
      <div className='auth-form-parent'>
        <form id='submit_form' className='perun-core-form fadeIn customForm recover-password-form' onSubmit={onSubmit}>
          {alert}
          <h4>
            {labels.formatMessage({
              id: `${config.labelBasePath}.login.e_app_recover_pass_title`,
              defaultMessage: `${config.labelBasePath}.login.e_app_recover_pass_title`
            })}
          </h4>
          <div className='subtitle'>
            {labels.formatMessage({
              id: `${config.labelBasePath}.login.recovery_message`,
              defaultMessage: `${config.labelBasePath}.login.recovery_message`
            })}
          </div>
          <InputElement
            id='idbrLogin'
            name='username'
            value={username}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.user_name`,
              defaultMessage: `${config.labelBasePath}.login.user_name`
            })}
            label='username'
            error={errors.username}
            type='text'
            onChange={onChange}
          />
          <button id='recoverpass_submit' type='submit' className='logonBtns'>
            <span>{labels.formatMessage({
              id: `${config.labelBasePath}.login.send_email`,
              defaultMessage: `${config.labelBasePath}.login.send_email`
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
    </div>
  )
}

export default LogonActions(LogonFunctions(RecoverPassword, 'RECOVER_PASS', 'recoverPassword1', 'recoverPassword'))
