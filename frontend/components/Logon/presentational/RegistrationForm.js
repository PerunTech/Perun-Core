import React, { useState, useEffect } from "react";
import LogonActions from '../functional/LogonActions'
import LogonFunctions from '../functional/LogonFunctions'
import { InputElement } from '../../../elements';
import { Loading } from "../../ComponentsIndex";
import { Link } from 'react-router-dom'
import * as config from '../../../config/config.js'
import axios from 'axios';
import { getCapsLockState } from '../../../functions/utils'

const RegistrationForm = (props, context) => {
  const { alert, errors, username, password, idNo, eMail, repeatPassword, } = props.internalComponentState
  const { onSubmit, onChange, onChangeFarmer, } = props
  const labels = context.intl
  const [loading, setLoading] = useState(false)
  const [farmer, setFarmer] = useState(true)
  const [showFarmReg, setFarmReg] = useState(undefined)
  const [showUserReg, setUserReg] = useState(undefined)
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    enableExternalRegistration()
  }, [])



  const enableExternalRegistration = () => {
    setLoading(true)
    const url = window.server + '/WsConf/params/get/sys/SHOW_REGISTRATION_FORM'
    axios.get(url)
      .then((response) => {
        setLoading(false)
        if (response.data)
          switch (response.data.VALUE) {
            case "farm":
              setFarmReg(true)
              setUserReg(false)
              setFarmer(true)
              break;
            case "user":
              setFarmReg(false)
              setUserReg(true)
              setFarmer(false)
              break;
            case "both":
              setFarmReg(true)
              setUserReg(true)
              setFarmer(true)
              break;
            case "none":
              setFarmReg(false)
              setUserReg(false)
              setFarmer(false)
              break;
            default:
              setFarmReg(true)
              setUserReg(false)
              setFarmer(true)
          }
      })
      .catch((error) => {
        setLoading(false)
        console.log(error);
      })
  }



  return (
    <React.Fragment>
      {loading && <Loading />}
      {!loading && (
        <div className='linkFormHolder'>
          <div className='auth-form-parent'>
            <form id='submit_form' className='perun-core-form fadeIn customForm registration-form' onSubmit={onSubmit}>
              {alert}
              <h4>
                {(showFarmReg || showUserReg) ? labels.formatMessage({
                  id: `${config.labelBasePath}.login.e_app_register_title`,
                  defaultMessage: `${config.labelBasePath}.login.e_app_register_title`
                }) : labels.formatMessage({
                  id: `${config.labelBasePath}.login.e_app_noregister_title`,
                  defaultMessage: `${config.labelBasePath}.login.e_app_noregister_title`
                })}
              </h4>
              <div className='userTypeHolder'>
                {showFarmReg && <button type='button' className={farmer ? 'conditionalLogonBtn1' : 'conditionalLogonBtn2'} onClick={() => {
                  setFarmer(true)
                  onChangeFarmer(true)
                }}>{labels.formatMessage({
                  id: `${config.labelBasePath}.login.user_condition2`,
                  defaultMessage: `${config.labelBasePath}.login.user_condition2`
                })}</button>}
                {showUserReg && <button type='button' className={`${farmer ? 'conditionalLogonBtn2' : 'conditionalLogonBtn1'} $`} onClick={() => {
                  setFarmer(false)
                  onChangeFarmer(false)
                }}>{labels.formatMessage({
                  id: `${config.labelBasePath}.login.user_condition1`,
                  defaultMessage: `${config.labelBasePath}.login.user_condition1`
                })}</button>}
              </div>
              {(showFarmReg || showUserReg) && <><InputElement
                name='farmer'
                value={farmer}
                style={{ 'display': 'none' }}
                type='text'
                id='regfarmer'
                label='farmer'
                onChange={onChange}
                error={errors.farmer}
              />
                <InputElement
                  name='username'
                  value={username}
                  placeholder={farmer ? labels.formatMessage({
                    id: `${config.labelBasePath}.login.user_name_condition1`,
                    defaultMessage: `${config.labelBasePath}.login.user_name_condition1`
                  }) : labels.formatMessage({
                    id: `${config.labelBasePath}.login.user_name_condition2`,
                    defaultMessage: `${config.labelBasePath}.login.user_name_condition2`
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
                  name='eMail'
                  value={eMail}
                  placeholder={labels.formatMessage({
                    id: `${config.labelBasePath}.login.email`,
                    defaultMessage: `${config.labelBasePath}.login.email`
                  })}
                  type='text'
                  id='regeMail'
                  label='eMail'
                  onChange={onChange}
                  error={errors.eMail}
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
                <InputElement
                  id='regRepeatPass'
                  name='repeatPassword'
                  value={repeatPassword}
                  placeholder={labels.formatMessage({
                    id: `${config.labelBasePath}.login.repeat_password`,
                    defaultMessage: `${config.labelBasePath}.login.repeat_password`
                  })}
                  label='repeatPassword'
                  error={errors.repeatPassword}
                  type='password'
                  onChange={onChange}
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
                <button id='register_submit' type='submit' className='logonBtns'>
                  <span>{labels.formatMessage({
                    id: `${config.labelBasePath}.login.register`,
                    defaultMessage: `${config.labelBasePath}.login.register`
                  })}</span>
                </button></>}
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
      )}
    </React.Fragment>
  )
}

export default LogonActions(LogonFunctions(RegistrationForm, 'REGISTER', 'register1', 'registerUser'))
