import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, Loading, GridManager, axios } from '../../client'
import { alertUserResponse, alertUserV2, ReactBootstrap } from '../../elements'
const { useReducer, useEffect } = React
const { Modal } = ReactBootstrap

const BusinessType = (props) => {
  const intl = useIntl()
  const initialState = { loading: false, canRender: false, businessObjectTypeName: undefined, gridId: undefined, show: false, objectId: 0 }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, canRender, businessObjectTypeName, gridId, show, objectId }, setState] = useReducer(reducer, initialState)

  useEffect(() => {
    // Get the name of the table
    getBusinessObjectTypeName()
  }, [])

  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId)
    }
  }, [gridId])

  const getBusinessObjectTypeName = () => {
    setState({ loading: true })
    const url = `${window.server}/WsConf/params/get/sys/BUSINESS_OBJECT_TYPE_NAME`
    axios.get(url).then(res => {
      setState({ loading: false })
      if (res?.data?.VALUE) {
        const objectTypeName = res.data.VALUE
        setState({ businessObjectTypeName: objectTypeName, gridId: `${objectTypeName}_GRID`, canRender: true })
      } else {
        alertUserV2({
          type: 'warning',
          title: intl.formatMessage({ id: 'perun.admin_console.business_type_name_missing_title', defaultMessage: 'perun.admin_console.business_type_name_missing_title' }),
          message: intl.formatMessage({ id: 'perun.admin_console.business_type_name_missing_message', defaultMessage: 'perun.admin_console.business_type_name_missing_message' }),
        })
      }
    }).catch(err => {
      setState({ loading: false })
      console.error(err)
      alertUserResponse({ response: err })
    })
  }

  const reloadGrid = () => {
    GridManager.reloadGridData(gridId)
    ComponentManager.setStateForComponent(gridId, 'rowClicked', undefined)
  }

  const handleRowClick = (_id, _rowIdx, row) => {
    setState({ objectId: row[`${businessObjectTypeName}.OBJECT_ID`] || 0, show: true })
  }

  const generateBusinessTypeGrid = () => {
    const { svSession } = props
    return (
      <ExportableGrid
        gridType='READ_URL'
        key={gridId}
        id={gridId}
        configTableName={`/ReactElements/getTableFieldList/${svSession}/${businessObjectTypeName}`}
        dataTableName={`/ReactElements/getTableData/${props.svSession}/${businessObjectTypeName}/0`}
        onRowClickFunct={handleRowClick}
        refreshData={true}
        toggleCustomButton={true}
        customButton={() => {
          setState({ show: true, objectId: 0 })
        }}
        customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}
        heightRatio={0.75}
        editContextFunc={handleRowClick}
      />
    )
  }

  const saveRecord = (e) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(`${businessObjectTypeName}_FORM`, null, { saveExecuted: false })
    const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/${businessObjectTypeName}/0`
    axios({
      method: 'post',
      data: encodeURIComponent(JSON.stringify(e.formData)),
      url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((res) => {
      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ type: resType, response: res, onConfirm })
        if (resType === 'success') {
          reloadGrid()
          setState({ show: false })
        }
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err, onConfirm })
    })
  }

  const generateBusinessTypeForm = (objectId) => {
    const { svSession } = props
    return (
      <GenericForm
        params={'READ_URL'}
        key={`${businessObjectTypeName}_FORM`}
        id={`${businessObjectTypeName}_FORM`}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${businessObjectTypeName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${businessObjectTypeName}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${objectId}/${businessObjectTypeName}`}
        addSaveFunction={(e) => saveRecord(e)}
        hideBtns={objectId === 0 ? 'closeAndDelete' : 'close'}
        addDeleteFunction={deleteFunc}
        className={'admin-settings-forms'}
      />
    )
  }

  const deleteFunc = (_id, _action, _session, formData) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(`${businessObjectTypeName}_FORM`, null, { deleteExecuted: false })
    const url = `${window.server}/ReactElements/deleteObject/${svSession}`
    axios({
      method: 'post',
      data: encodeURIComponent(formData[4]['PARAM_VALUE']),
      url: url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((res) => {
      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ type: resType, response: res, onConfirm })
        if (resType === 'success') {
          reloadGrid()
          setState({ show: false })
        }
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err, onConfirm })
    })
  }

  return (
    <>
      {loading && <Loading />}
      {canRender && (
        <div className='admin-console-grid-container'>
          <div className='admin-console-component-header'>
            <p>{intl.formatMessage({ id: 'perun.admin_console.business_type', defaultMessage: 'perun.admin_console.business_type' })}</p>
          </div>
          {generateBusinessTypeGrid()}
        </div>
      )}
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => setState({ show: false })}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
            <Modal.Title>{intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}</Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generateBusinessTypeForm(objectId)}
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(BusinessType)
