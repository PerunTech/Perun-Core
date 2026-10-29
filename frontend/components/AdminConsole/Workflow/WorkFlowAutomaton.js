import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, Loading, GridManager, axios } from '../../../client'
import { alertUserResponse, ReactBootstrap } from '../../../elements'
import WorkFlowItem from './WorkFlowItem'
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton'
const { useReducer, useEffect } = React
const { Modal } = ReactBootstrap

const WorkFlowAutomaton = (props) => {
  const intl = useIntl()
  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id })
  const initialState = { loading: false, canRender: true, gridId: 'SVAROG_WORKFLOW_AUTOMATON', show: false, objectId: 0, recordLabel: '' }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, canRender, gridId, show, objectId, recordLabel }, setState] = useReducer(reducer, initialState)


  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId)
    }
  }, [gridId])



  const reloadGrid = () => {
    GridManager.reloadGridData(gridId)
    ComponentManager.setStateForComponent(gridId, 'rowClicked', undefined)
  }

  const handleRowClick = (_id, _rowIdx, row) => {
    setState({ objectId: row[`SVAROG_WORKFLOW_AUTOMATON.OBJECT_ID`] || 0, recordLabel: row[`SVAROG_WORKFLOW_AUTOMATON.WORKFLOW_AUTOMATON_LABEL`] || '', show: true })
  }

  const generateWorkFlowGrid = () => {
    const { svSession } = props
    return (
      <ExportableGrid
        gridType='READ_URL'
        key={gridId}
        id={gridId}
        configTableName={`/ReactElements/getTableFieldList/${svSession}/SVAROG_WORKFLOW_AUTOMATON`}
        dataTableName={`/ReactElements/getTableData/${svSession}/SVAROG_WORKFLOW_AUTOMATON/0`}
        onRowClickFunct={handleRowClick}
        refreshData={true}
        toggleCustomButton={true}
        customButton={() => {
          setState({ show: true, objectId: 0, recordLabel: '' })
        }}
        customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}
        heightRatio={0.75}
        editContextFunc={handleRowClick}
      />
    )
  }

  const saveRecord = (e) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(`SVAROG_WORKFLOW_AUTOMATON_FORM`, null, { saveExecuted: false })
    const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/SVAROG_WORKFLOW_AUTOMATON/0`
    setState({ loading: true })
    axios({
      method: 'post',
      data: encodeURIComponent(JSON.stringify(e.formData)),
      url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((res) => {
      setState({ loading: false })
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
      setState({ loading: false })
      alertUserResponse({ response: err, onConfirm })
    })
  }

  const generateWorkFlowForm = (objectId) => {
    const { svSession } = props
    return (
      <GenericForm
        params={'READ_URL'}
        key={`SVAROG_WORKFLOW_AUTOMATON_FORM`}
        id={`SVAROG_WORKFLOW_AUTOMATON_FORM`}
        method={`/ReactElements/getTableJSONSchema/${svSession}/SVAROG_WORKFLOW_AUTOMATON`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/SVAROG_WORKFLOW_AUTOMATON`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${objectId}/SVAROG_WORKFLOW_AUTOMATON`}
        addSaveFunction={(e) => saveRecord(e)}
        hideBtns={objectId === 0 ? 'closeAndDelete' : 'close'}
        addDeleteFunction={deleteFunc}
        className={'admin-settings-forms'}
      />
    )
  }

  const deleteFunc = (_id, _action, _session, formData) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(`SVAROG_WORKFLOW_AUTOMATON_FORM`, null, { deleteExecuted: false })
    const url = `${window.server}/ReactElements/deleteObject/${svSession}`
    setState({ loading: true })
    axios({
      method: 'post',
      data: encodeURIComponent(formData[4]['PARAM_VALUE']),
      url: url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((res) => {
      setState({ loading: false })
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
      setState({ loading: false })
      alertUserResponse({ response: err, onConfirm })
    })
  }

  return (
    <>
      {loading && <Loading />}
      {canRender && (
        <div className='admin-console-grid-container'>
          <div className='admin-console-component-header'>
            <p>{intl.formatMessage({ id: 'perun.admin_console.work_flow_auto', defaultMessage: 'perun.admin_console.work_flow_auto' })}</p>
            <AdminConsoleHelpButton title={{ id: 'perun.admin_console.work_flow_auto', defaultMessage: 'perun.admin_console.work_flow_auto' }} />
          </div>
          {generateWorkFlowGrid()}
        </div>
      )}
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => setState({ show: false })}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
            <Modal.Title>{objectId ? (recordLabel || fmt('perun.admin_console.work_flow_auto')) : fmt('perun.admin_console.add')}</Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generateWorkFlowForm(objectId)}
            {objectId > 0 && <WorkFlowItem autoId={objectId} />}
          </Modal.Body>
        </Modal>
      )}
    </>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(WorkFlowAutomaton)
