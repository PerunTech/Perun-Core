import React, { useEffect, useState, useRef } from 'react'
import LogonActions from '../functional/LogonActions'
import LogonFunctions from '../functional/LogonFunctions'
import { InputElement } from '../../../elements';
import { Link } from 'react-router-dom'
import * as config from '../../../config/config.js'
import { getCapsLockState, getServerOrigin } from '../../../functions/utils';

const LoginForm = (props, context) => {
  const { alert, errors, username, password } = props.internalComponentState
  const { onSubmit, onSamlSubmit, onChange } = props
  const labels = context.intl
  const [logonImgJson, setLogonImgJson] = useState([])
  const [projectImgJson, setProjectImgJson] = useState([])
  const [loginLinks, setLoginLinks] = useState([])
  const [ssoData, setSsoData] = useState([])
  // This is needed for keeping track when the component is mounted and performing state changes, so React doesn't complain
  const componentIsMounted = useRef(true)
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    getLogonImgJson()
    getLoginLinks()
    getProjectImgJson()
    generateSsoBtn()
    return () => {
      componentIsMounted.current = false
    }
  }, [])

  const getLoginLinks = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/LoginLinks.json`
    fetch(url).then(res => res.json()).then(json => {
      if (componentIsMounted.current) {
        setLoginLinks(json)
      }
    }).catch(err => { throw err });
  }

  const getLogonImgJson = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/LogonImg.json`
    fetch(url).then(res => res.json()).then(json => {
      if (componentIsMounted.current) {
        setLogonImgJson(json)
      }
    }).catch(err => { throw err })
  }

  const getProjectImgJson = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/ProjectImg.json`
    fetch(url).then(res => res.json()).then(json => {
      if (componentIsMounted.current) {
        setProjectImgJson(json)
      }
    }).catch(err => { throw err })
  }

  const generateSsoBtn = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/AltLogin.json`
    fetch(url).then(res => res.json()).then(json => {
      if (componentIsMounted.current) {
        setSsoData(json)
      }
    }).catch(err => { throw err });
  }

  return (
    <div id='holder' className='holderLogon'>
      <div className='onlyLoginCustomHeight'>
        <form id='submit_form' className='perun-core-form fadeIn login-form' onSubmit={onSubmit}>
          {alert}
          <div className='login-main-container'>
            <div className='login-container'>
              <div>
                <div className='login-form-title'>
                  <h4>
                    {labels.formatMessage({
                      id: `${config.labelBasePath}.login.login_form_title`,
                      defaultMessage: `${config.labelBasePath}.login.login_form_title`
                    })}
                  </h4>
                </div>
                <InputElement
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
                  id='idbrLogin'
                  className='inputLoginStyle'
                />
                <InputElement
                  name='password'
                  value={password}
                  placeholder={labels.formatMessage({
                    id: `${config.labelBasePath}.login.password`,
                    defaultMessage: `${config.labelBasePath}.login.password`
                  })}
                  type='password'
                  id='passLogin'
                  label='password'
                  onChange={onChange}
                  error={errors.password}
                  className='inputLoginStyle'
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
                <button id='login_submit' className='logonBtns' type='submit'>
                  <span>{labels.formatMessage({
                    id: `${config.labelBasePath}.login.login`,
                    defaultMessage: `${config.labelBasePath}.login.login`
                  })}</span>
                </button>
                {ssoData?.length > 0 && ssoData.map(data => (
                  <button key={data.id} id={`login_submit_saml ${data.id}`} className={`nav-link saml-login ${data.className}`} type='button' onClick={onSamlSubmit}>
                    <div className='sso-btn-container'>
                      <div className='sso-img-container'>
                        <img src={data.src} />
                      </div>
                      <p>{labels.formatMessage({
                        id: `perun.login.${data.labelCode}`,
                        defaultMessage: `perun.login.${data.labelCode}`
                      })}</p>
                    </div>
                  </button>
                ))}
              </div>
              {logonImgJson?.length > 0 && (
                <div className='logonImg' onDoubleClick={function() { window.localStorage.clear(); }}>
                  {logonImgJson.map(img => {
                    return (
                      <img key={img.id} id={img.id} src={img.src} className={img.className} />
                    )
                  })}
                </div>
              )}
            </div>
            {loginLinks?.length > 0 && (
              <React.Fragment>
                <div className='verticalLine' />
                <div className='alt-links-container'>
                  <div className='linkStyle'>
                    {loginLinks.map((item, index) => {
                      return (
                        <div key={`${item.id}_${index}`}>
                          {item?.href ? <Link to={item.href} key={item.id} className={item.className}>
                            {labels.formatMessage({
                              id: `perun.login.${item.id}`,
                              defaultMessage: `perun.login.${item.id}`
                            })}
                          </Link> : <div id={item.id} key={item.id} className={item.className}>
                            <img src={item.src} className={item.className + '-img'} />
                          </div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>
        </form>
      </div>
      {projectImgJson?.length > 0 && (
        <div id='imgProject' className='projectImg'>
          {projectImgJson.map(img => {
            return (
              <div key={img.id} className={img.containerClassName}>
                {img.href ? (
                  <a href={img.href} target='_blank' rel='noopener noreferrer' id={img.id} className={img.linkClassName}>
                    <img src={img.src} className={img.imgClassName} />
                  </a>
                ) : (
                  <img src={img.src} className={img.imgClassName} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LogonActions(LogonFunctions(LoginForm, 'LOGIN', 'login1', 'loginUser'))
