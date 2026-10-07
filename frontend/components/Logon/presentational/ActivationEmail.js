import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import LogonActions from '../functional/LogonActions'
import LogonFunctions from '../functional/LogonFunctions'
import { InputElement } from '../../../elements'
import { getCapsLockState } from '../../../functions/utils'
import * as config from '../../../config/config.js'

const ActivationEmail = (props, context) => {
  const { alert, errors, username, password, idNo } = props.internalComponentState
  const { onSubmit, onChange } = props
  const labels = context.intl
  const [capsLockOn, setCapsLockOn] = useState(false);

  return (
    <div className='linkFormHolder'>
      <div className='auth-form-parent'>
        <form id='submit_form' className='perun-core-form fadeIn customForm activate-email-form' onSubmit={onSubmit}>
          {alert}
          <h4>
            {labels.formatMessage({
              id: `${config.labelBasePath}.login.activation_link`,
              defaultMessage: `${config.labelBasePath}.login.activation_link`
            })}
          </h4>
          <InputElement
            name='username'
            value={username}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.user_name`,
              defaultMessage: `${config.labelBasePath}.login.user_name`
            })}
            type='text'
            id='regUsername'
            label='username'
            onChange={onChange}
            error={errors.username}
          />
          <InputElement
            name='idNo'
            value={idNo}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.pin`,
              defaultMessage: `${config.labelBasePath}.login.pin`
            })}
            type='text'
            id='regidNo'
            label='idNo'
            onChange={onChange}
            error={errors.idNo}
            maxLength={13}
          />
          <InputElement
            name='password'
            value={password}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.password`,
              defaultMessage: `${config.labelBasePath}.login.password`
            })}
            type='password'
            id='regPassword'
            label='password'
            onChange={onChange}
            error={errors.password}
            onKeyUp={(event) => getCapsLockState(event, setCapsLockOn)}
          />
          {capsLockOn && (
            <p className='caps-lock-is-active'>
              {labels.formatMessage({
                id: `${config.labelBasePath}.admin_console.caps_lock_active`,
                defaultMessage: `${config.labelBasePath}.admin_console.caps_lock_active`
              })}
            </p>
          )}
          <button id='activation_submit' type='submit' className='logonBtns'>
            <span>{labels.formatMessage({
              id: `${config.labelBasePath}.login.activation_link_submit`,
              defaultMessage: `${config.labelBasePath}.login.activation_link_submit`
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

export default LogonActions(LogonFunctions(ActivationEmail, 'ACTIVATION_LINK_FORM', 'activateLink1', 'activateLink'))
