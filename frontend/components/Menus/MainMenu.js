/* eslint-disable */
import React, { useEffect, useReducer } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import axios from 'axios'
import { createHashHistory } from 'history'
import { store, logoutUser, isValidObject } from '../../model';
import { alertUserResponse } from '../../elements'
import { svConfig } from '../../config';
import * as cookies from '../../functions/cookies'
import { getServerOrigin } from '../../functions/utils'
import { submitForm } from '../Logon/utils'
import PerunNavbar from '../Navbar/PerunNavbar'
import Loading from '../Loading/Loading'
import { changeLanguageAndLocale } from '../../client'

const MainMenu = (props) => {
  const hashHistory = createHashHistory()
  const initialState = { loading: false, navbarImgJson: [], languageOptions: [], currentUser: '', activeLanguage: '', renderTasks: false }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, navbarImgJson, languageOptions, currentUser, activeLanguage, renderTasks }, setState] = useReducer(reducer, initialState)

  useEffect(() => {
    getNavbarImgJson()
    getLanguageOptions()
    getLocale()
    getCurrentUser()
    shouldRenderTasks()
  }, [])

  const getNavbarImgJson = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/NavbarImg.json`
    fetch(url).then(res => res.json()).then(json => {
      setState({ navbarImgJson: json })
    }).catch(err => { throw err })
  }

  const getLanguageOptions = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/LanguageOptions.json`
    fetch(url).then(res => res.json()).then(json => {
      setState({ languageOptions: json })
    }).catch(err => { throw err })
  }

  const getCurrentUser = () => {
    const verbPath = `SvSecurity/getPersonalUserInfo/${props.token}/user_info`
    const url = `${window.server}/${verbPath}`
    axios.get(url).then(res => {
      if (res?.data && res?.data?.data) {
        const resData = res.data.data?.['com.prtech.svarog_common.DbDataObject'] || {}
        const defaultUserGroupData = res.data.data?.default_user_group || {}
        const userAvatarData = res.data.data?.user_avatar_file_info || {}
        const userData = {}
        // Get the individual user values, since they're a bit nested
        if (resData && resData.values) {
          const values = resData.values
          values.forEach(value => {
            if (value.USER_NAME) {
              Object.assign(userData, { username: value.USER_NAME })
              setState({ currentUser: value.USER_NAME })
            }
          })
        }


        // Get the individual system user values (ex. object ID, parent ID), since they're returned separately from the non-system values
        if (isValidObject(resData, 1)) {
          Object.assign(userData, { userObjectId: resData?.object_id || 0, userId: resData?.user_id || 0 })
        }

        // Get the individual values for the default user group
        if (isValidObject(defaultUserGroupData, 1)) {
          const defaultUserGroup = {
            groupName: defaultUserGroupData.GROUP_NAME || '',
            groupType: defaultUserGroupData.GROUP_TYPE || '',
            groupObjectId: defaultUserGroupData.object_id || 0,
          }
          Object.assign(userData, { defaultUserGroup })
        }

        // Get the individual values for the user avatar
        if (isValidObject(userAvatarData, 1)) {
          const avatar = {
            objectId: userAvatarData.objectId || 0,
            fileName: userAvatarData.fileName || '',
          }
          Object.assign(userData, { avatar })
        }

        store.dispatch({ type: 'GET_CURRENT_USER_DATA', payload: userData })
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err })
    })
  }

  const onSamlLogout = () => {
    setState({ loading: true })
    axios.get(`${window.server}/SvSecurity/configuration/getConfiguration/undefined/LOGIN`).then(res => {
      if (res.data?.data) {
        const configuration = res.data.data
        if (configuration.sso_config && isValidObject(configuration.sso_config, 1)) {
          const sloConfig = configuration.sso_config
          const sloFormKey = sloConfig.SLO_FORM_KEY
          const sloFormValue = sloConfig.SLO_FORM_VALUE.replace('{session}', props.token);
          const sloMethod = sloConfig.SLO_METHOD
          const sloUrl = sloConfig.SLO_URL
          axios.get(`${window.server}${sloFormValue}`).then(res => {
            setState({ loading: false })
            if (res.data) {
              const token = res.data
              submitForm(sloUrl, sloMethod, { [sloFormKey]: token })
            }
          }).catch(err => {
            console.error(err)
            setState({ loading: false })
            alertUserResponse({ response: err })
          })
        }
      }
    }).catch(err => {
      console.error(err)
      setState({ loading: false })
    })
  }

  const logout = () => {
    if (props?.samlFlag) {
      onSamlLogout()
    } else {
      const restUrl = svConfig.restSvcBaseUrl + svConfig.triglavRestVerbs.CORE_LOGOUT + props.token
      store.dispatch(logoutUser(restUrl))
      hashHistory.push('/')
    }
  }

  const getLocale = () => {
    const locale = cookies.getCookie('defaultLocale')
    setState({ activeLanguage: locale })
  }

  const changeLang = (locale, lang) => {
    switchServerLanguage(lang, locale)
  }

  const switchServerLanguage = (lang, locale) => {
    let url = window.server + `/SvSecurity/i18n/${lang}/perun/${props.token}`
    axios.get(url).then(() => {
      if (locale) {
        changeLanguageAndLocale(locale, lang)
      }
    }).catch(err => {
      console.error(err)
    })
  }

  const shouldRenderTasks = () => {
    const url = `${window.server}/WsConf/params/get/sys/SHOW_TASKS_NAVBAR`
    axios.get(url).then(res => {
      if (res?.data?.VALUE) {
        setState({ renderTasks: res.data.VALUE })
      }
    }).catch(err => {
      console.error(err)
    })
  }

  return (
    <React.Fragment>
      {loading && <Loading />}
      <PerunNavbar logout={logout} activeLanguage={activeLanguage} renderTasks={renderTasks} languageOptions={languageOptions} location={window.location} changeLang={changeLang} />
    </React.Fragment>
  )
}

MainMenu.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  token: state.security.svSession,
  samlFlag: state.security?.saml
})

export default connect(mapStateToProps)(MainMenu)
