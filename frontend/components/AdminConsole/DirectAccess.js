import React, { useEffect, useReducer } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import axios from 'axios'
import Select from 'react-select'
import { alertUserV2, alertUserResponse } from '../../elements'
import Loading from '../Loading/Loading'

const DirectAccess = (props, context) => {
  const initialState = {
    loading: false, typeAccess: '', showGroup: false, showModule: false, multiValue: '', contextName: '', filterOptions: {}, filterOptionsModules: {}
  }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, typeAccess, showGroup, showModule, multiValue, contextName, filterOptions, filterOptionsModules }, setState] = useReducer(reducer, initialState)

  useEffect(() => {
    getAllGroups()
  }, [])

  const callOnSave = () => {
    const directAccessChangeLabel = context.intl.formatMessage({ id: 'perun.admin_console.direct_access_change', defaultMessage: 'perun.admin_console.direct_access_change' })
    const missingParamsLabel = context.intl.formatMessage({ id: 'perun.missingParams', defaultMessage: 'perun.missingParams' })
    const enterValuesLabel = context.intl.formatMessage({ id: 'perun.please_enter_values', defaultMessage: 'perun.please_enter_values' })
    const yesLabel = context.intl.formatMessage({ id: 'perun.admin_console.yes', defaultMessage: 'perun.admin_console.yes' })
    const noLabel = context.intl.formatMessage({ id: 'perun.admin_console.no', defaultMessage: 'perun.admin_console.no' })
    const alertParams = {
      type: 'question',
      title: directAccessChangeLabel,
      confirmButtonText: yesLabel,
      confirmButtonColor: '#87adbd',
      onConfirm: onSave,
      showCancel: true,
      cancelButtonText: noLabel
    }
    if ((contextName && multiValue.length > 0) && (showModule && showGroup)) {
      alertUserV2(alertParams)
    } else if (contextName && (showModule && showGroup === false)) {
      alertUserV2(alertParams)
    } else {
      alertUserV2({ type: 'info', title: missingParamsLabel, message: enterValuesLabel })
    }
  }

  const onSave = () => {
    setState({ loading: true })
    const saveJson = prepareSaveJson(multiValue, typeAccess);
    const restUrl = `${window.server}/WsConf/saveTypeAccess/${props.svSession}/${contextName.value}`
    let form_params = new URLSearchParams()
    form_params.append('guiMeta', JSON.stringify(saveJson))
    axios({
      method: 'post',
      data: form_params,
      url: restUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then(res => {
      setState({ loading: false })
      if (res?.data) {
        alertUserResponse({ response: res.data })
        setState({ typeAccess: '', multiValue: '', contextName: '', showGroup: '', showModule: '' })
        getAllGroups()
      }
    }).catch(error => {
      console.error(error)
      setState({ loading: false })
      alertUserResponse({ response: error })
    })
  }

  const singleOptionValueDrop = (modulesV) => {
    let modules = modulesV
    modules = JSON.stringify(modules);
    modules = modules.replaceAll('text', 'label')
    modules = JSON.parse(modules)
    setState({ filterOptionsModules: modules })
  }

  const prepareSaveJson = (multiValue, typeAccess) => {
    if (typeAccess.value === 'directAccess')
      return { 'directAccess': true }

    if (typeAccess.value === 'accessGroup') {
      let groups = []
      multiValue.map((el) => {
        groups.push(el.label)
      })
      return { 'directAccess': false, 'accessGroup': groups }
    }
  }

  const createUpdateTableAccessModal = (data) => {
    let allGroups = data.data
    allGroups = JSON.stringify(allGroups);
    allGroups = allGroups.replaceAll('groupName', 'label')
    allGroups = allGroups.replaceAll('objectId', 'value')
    allGroups = JSON.parse(allGroups)
    setState({ filterOptions: allGroups, loading: true })

    const url = `${window.server}/ReactElements/getOptionsFromTable/${props.svSession}/SVAROG_PERUN_PLUGIN/CONTEXT_NAME`
    axios.get(url).then((response) => {
      setState({ loading: false })
      if (response?.data) {
        singleOptionValueDrop(response.data.data)
      }
    }).catch((error) => {
      console.error(error)
      setState({ loading: false })
      alertUserResponse({ response: error })
    })
  }

  const getAllGroups = () => {
    setState({ loading: true })
    const url = `${window.server}/WsAdminConsole/getAllGroups/${props.svSession}`
    axios.get(url).then((response) => {
      setState({ loading: false })
      if (response?.data) {
        createUpdateTableAccessModal(response.data)
      }
    }).catch((error) => {
      console.error(error)
      setState({ loading: false })
      alertUserResponse({ response: error })
    })
  }

  const writeTypeAccess = (object) => {
    if (object.value === 'directAccess') {
      setState({ typeAccess: object, showGroup: false, showModule: true, multiValue: '', contextName: '' })
    }

    if (object.value === 'accessGroup') {
      setState({ typeAccess: object, showGroup: true, showModule: false, multiValue: '', contextName: '' })
    }
  }

  const handleMultiChange = (option) => {
    setState({ multiValue: option, showModule: true })
  }

  const handleChange = (value) => {
    setState({ contextName: value })
  }

  const keyTypeAccess = [
    {
      label: context.intl.formatMessage({
        id: 'perun.admin_console.direct_access_module.direct_access',
        defaultMessage: 'perun.admin_console.direct_access_module.direct_access'
      }),
      value: 'directAccess'
    },
    {
      label: context.intl.formatMessage({
        id: 'perun.admin_console.direct_access_module.access_group',
        defaultMessage: 'perun.admin_console.direct_access_module.access_group'
      }),
      value: 'accessGroup'
    }
  ]

  return (
    <div className='admin-console-direct-access'>
      {loading && <Loading />}
      <div id='dropDownContainer' className='admin-console-dropdown-container'>
        <div id='title' className='admin-console-dropdown-title admin-console-legend'>
          <p style={{ marginBottom: '0.5vh' }}>
            {context.intl.formatMessage({ id: 'perun.adminConsole.direct_access_module', defaultMessage: 'perun.adminConsole.direct_access_module' })}
          </p>
        </div>
        <div id='dropDownHolder' className='admin-console-dropdown-holder'>
          <p className='admin-console-choose-desc'>
            {context.intl.formatMessage({
              id: 'perun.adminConsole.choose_dropDown_value_for_module_menu',
              defaultMessage: 'perun.adminConsole.choose_dropDown_value_for_module_menu'
            })}
          </p>
          <Select
            name='typeKey'
            placeholder={context.intl.formatMessage({ id: 'perun.admin_console.module_access_key', defaultMessage: 'perun.admin_console.module_access_key' })}
            value={typeAccess}
            options={keyTypeAccess}
            onChange={writeTypeAccess}
          />
          {showGroup && (
            <React.Fragment>
              <p className='admin-console-second-choose-desc'>
                {context.intl.formatMessage({
                  id: 'perun.adminConsole.choose_dropDown_value_for_module_access_group',
                  defaultMessage: 'perun.adminConsole.choose_dropDown_value_for_module_access_group'
                })}
              </p>
              <Select style={{ marginTop: '1vh' }}
                name='filters'
                placeholder={context.intl.formatMessage({ id: 'perun.admin_console.module_access_groups', defaultMessage: 'perun.admin_console.module_access_groups' })}
                value={multiValue}
                options={filterOptions}
                onChange={handleMultiChange}
                multi
              />
            </React.Fragment>
          )}
          {showModule && (
            <React.Fragment>
              <p className='admin-console-second-choose-desc'>
                {context.intl.formatMessage({
                  id: 'perun.adminConsole.choose_dropDown_value_for_module_name',
                  defaultMessage: 'perun.adminConsole.choose_dropDown_value_for_module_name'
                })}
              </p>
              <Select style={{ marginTop: '1vh' }}
                name='access'
                placeholder={context.intl.formatMessage({ id: 'perun.admin_console.module_name', defaultMessage: 'perun.admin_console.module_name' })}
                value={contextName}
                options={filterOptionsModules}
                onChange={handleChange}
              />
              <button id='saveBtn' className='btn-success btn_save_form' style={{ float: 'right', marginTop: '2vh' }} onClick={callOnSave}>
                {context.intl.formatMessage({ id: 'perun.adminConsole.save', defaultMessage: 'perun.adminConsole.save' })}
              </button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  )
}

DirectAccess.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  svSession: state.security.svSession
})

export default connect(mapStateToProps)(DirectAccess)
