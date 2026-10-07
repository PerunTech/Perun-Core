import React from 'react'
import PropTypes from 'prop-types'
import axios from 'axios'
import { connect } from 'react-redux'
import Form from '@rjsf/core'
import { ComponentManager, ExportableGrid, GridManager, Loading } from '../../client'
import { alertUserV2, alertUserResponse, ReactBootstrap } from '../../elements'
import AdminConsoleHelpButton from './Help/AdminConsoleHelpButton'
import HelpFieldTemplate from '../../elements/fieldHelp/HelpFieldTemplate';
import { getNotificationsFormSchema } from './utils/notificationsFormSchema'
import { flattenObject } from '../../model/utils'
import validator from '@rjsf/validator-ajv8'
const { useReducer, useEffect } = React
const { Modal } = ReactBootstrap

const NotificationsComponent = (props, context) => {
  const initialState = {
    tableName: 'SVAROG_NOTIFICATION', loading: false, gridId: 'SVAROG_NOTIFICATION_GRID', show: false,
    objectId: 0, selectedRow: undefined, formData: undefined
  }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ tableName, loading, gridId, show, objectId, selectedRow, formData }, setState] = useReducer(reducer, initialState)
  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId)
    }
  }, [gridId])

  const onHide = () => {
    setState({ show: false, objectId: 0, selectedRow: undefined, formData: undefined })
  }

  const handleRowClick = (_id, _rowIdx, row) => {
    const formData = {}
    // Remove the tableName (SVAROG_NOTIFICATIONS) part from the selected row object keys
    for (const key in row) {
      if (key.includes(tableName)) {
        const newKey = key.split('.')[1]
        Reflect.set(formData, newKey, row[key])
      }
    }
    // Get and set the appropriate data in their respective sections
    const { OBJECT_ID, PKID, OBJECT_TYPE } = formData
    const finalFormData = {
      OBJECT_ID, PKID, OBJECT_TYPE,
      section_one: { TYPE: formData.TYPE || '', TITLE: formData.TITLE || '' },
      section_two: { MESSAGE: formData.MESSAGE || '' }
    }
    setState({ objectId: row[`${tableName}.OBJECT_ID`] || 0, selectedRow: formData, formData: finalFormData, show: true })
  }

  const generateNotificationsGrid = () => {
    const { svSession } = props
    return (
      <ExportableGrid
        gridType='READ_URL'
        key={gridId}
        id={gridId}
        configTableName={`/ReactElements/getTableFieldList/${svSession}/${tableName}`}
        dataTableName={`/ReactElements/getTableData/${props.svSession}/${tableName}/0`}
        onRowClickFunct={handleRowClick}
        refreshData={true}
        toggleCustomButton={true}
        customButton={() => {
          setState({ show: true, objectId: 0, selectedRow: undefined, formData: undefined })
        }}
        customButtonLabel={context.intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}
        heightRatio={0.75}
        editContextFunc={handleRowClick}
      />
    )
  }

  const reloadGrid = () => {
    GridManager.reloadGridData(gridId)
    ComponentManager.setStateForComponent(gridId, 'rowClicked', undefined)
  }

  const saveNotification = (e, url) => {
    setState({ loading: true })
    const formData = flattenObject(e.formData)
    const data = encodeURIComponent(JSON.stringify(formData))
    const reqConfig = { method: 'post', data, url, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    axios(reqConfig).then((res) => {
      setState({ loading: false })

      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ type: resType, response: res })
        if (resType === 'success') {
          onHide()
          reloadGrid()
        }
      }
    }).catch((err) => {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    })
  }

  const deleteNotification = () => {
    setState({ loading: true })
    const wsPath = `/ReactElements/deleteObject/${props.svSession}`
    const url = `${window.server}${wsPath}`
    const data = encodeURIComponent(JSON.stringify(selectedRow))
    const reqConfig = { method: 'post', data, url, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    axios(reqConfig).then((res) => {
      setState({ loading: false })

      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ type: resType, response: res })
        if (resType === 'success') {
          onHide()
          reloadGrid()
        }
      }
    }).catch(err => {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    })
  }

  const onDelete = () => {
    const title = context.intl.formatMessage({ id: 'perun.admin_console.delete_notification', defaultMessage: 'perun.admin_console.delete_notification' })
    const yesLabel = context.intl.formatMessage({ id: 'perun.admin_console.yes', defaultMessage: 'perun.admin_console.yes' })
    const noLabel = context.intl.formatMessage({ id: 'perun.admin_console.no', defaultMessage: 'perun.admin_console.no' })

    alertUserV2({
      type: 'warning',
      title,
      confirmButtonText: yesLabel,
      onConfirm: deleteNotification,
      confirmButtonColor: '#8d230f',
      showCancel: true,
      cancelButtonText: noLabel
    })
  }

  const generateNotificationForm = () => {
    const { schema, uiSchema } = getNotificationsFormSchema(context)
    const data = formData || {}
    const wsPath = `/ReactElements/createTableRecordFormData/${props.svSession}/${tableName}/0`
    const url = `${window.server}${wsPath}`
    const onSubmit = (e) => saveNotification(e, url)

    return (
      <Form validator={validator} className='notifications-form' schema={schema} uiSchema={uiSchema} formData={data} onSubmit={onSubmit} templates={{ FieldTemplate: HelpFieldTemplate }}>
        <></>
        <div id='buttonHolder'>
          <div id='btnSeparator' style={{ width: 'auto', float: 'right' }}>
            <button type='submit' id='save_form_btn' className='btn-success btn_save_form'>
              {context.intl.formatMessage({ id: 'perun.adminConsole.save', defaultMessage: 'perun.adminConsole.save' })}
            </button>
          </div>
          {formData && (
            <button type='button' id='delete_form_btn' className='btn-danger btn_delete_form' onClick={onDelete}>
              {context.intl.formatMessage({ id: 'perun.generalLabel.delete', defaultMessage: 'perun.generalLabel.delete' })}
            </button>
          )}
        </div>
      </Form>
    )
  }

  const announcementMsg = { id: 'perun.admin_console.announcement', defaultMessage: 'perun.admin_console.announcement' }

  return (
    <>
      {loading && <Loading />}
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{context.intl.formatMessage(announcementMsg)}</p>
          <AdminConsoleHelpButton title={announcementMsg} />
        </div>
        {generateNotificationsGrid()}
      </div>
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => onHide()}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
            <Modal.Title>
              {context.intl.formatMessage(announcementMsg)}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generateNotificationForm(objectId)}
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  )
}

NotificationsComponent.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  svSession: state.security.svSession
})

export default connect(mapStateToProps)(NotificationsComponent)
