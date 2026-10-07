import React from 'react'
import { Link } from 'react-router-dom'
import LogonActions from '../functional/LogonActions'
import LogonFunctions from '../functional/LogonFunctions'
import { InputElement } from '../../../elements';
import * as config from '../../../config/config.js'

const ChangeEmail = (props, context) => {
  const { alert, errors, username, idNo, eMail } = props.internalComponentState
  const { onSubmit, onChange } = props
  const labels = context.intl
  return (
    <div className='linkFormHolder'>
      <div className='auth-form-parent'>
        <form id='submit_form' className='perun-core-form fadeIn customForm change-email-form' onSubmit={onSubmit}>
          {alert}
          <h4>
            {labels.formatMessage({
              id: `${config.labelBasePath}.login.change_email_title`,
              defaultMessage: `${config.labelBasePath}.login.change_email_title`
            })}
          </h4>
          <InputElement
            id='unameChEmail'
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
          <InputElement
            id='idNoChEmail'
            name='idNo'
            value={idNo}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.pin`,
              defaultMessage: `${config.labelBasePath}.login.pin`
            })}
            type='text'
            label='idNo'
            onChange={onChange}
            error={errors.idNo}
            maxLength={13}
          />
          <InputElement
            id='repeatChPass'
            name='eMail'
            value={eMail}
            placeholder={labels.formatMessage({
              id: `${config.labelBasePath}.login.email`,
              defaultMessage: `${config.labelBasePath}.login.email`
            })}
            label='eMail'
            error={errors.eMail}
            type='text'
            onChange={onChange}
          />
          <button id='changeemail_submit' type='submit' className='logonBtns'>
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

export default LogonActions(LogonFunctions(ChangeEmail, 'CHANGE_EMAIL', 'change_email1', 'changeEmail'))
