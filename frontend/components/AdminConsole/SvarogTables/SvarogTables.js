import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, Loading } from '../../../client'
import { alertUserV2, ReactBootstrap } from '../../../elements'
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton'
import SvarogTableFormWrapper from './SvarogTableFormWrapper'
import { TABLE_UISCHEMA_OVERRIDE } from './svarogTableUtils'
import CustomCheckboxWidget from './CustomCheckboxWidget'

const TABLE_ADDITIONAL_WIDGETS = { CustomCheckboxWidget }
const { useReducer, useEffect } = React
const { Modal } = ReactBootstrap

const SvarogTables = (props) => {
  const intl = useIntl()
  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id })
  const initialState = { tableName: 'SVAROG_TABLES', loading: false, gridId: 'SVAROG_TABLES_GRID', show: false, objectId: 0, selectedTableName: '' }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ tableName, loading, gridId, show, objectId, selectedTableName }, setState] = useReducer(reducer, initialState)

  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId)
    }
  }, [gridId])

  const handleRowClick = (_id, _rowIdx, row) => {
    setState({ objectId: row[`${tableName}.OBJECT_ID`] || 0, selectedTableName: row[`${tableName}.TABLE_NAME`] || '', show: true })
  }

  const generateSvarogTablesGrid = () => {
    const { svSession } = props
    return (
      <ExportableGrid
        gridType='READ_URL'
        key={gridId}
        id={gridId}
        configTableName={`/ReactElements/getTableFieldList/${svSession}/${tableName}`}
        dataTableName={`/ReactElements/getTableWithFilter/${props.svSession}/SVAROG_TABLES/IS_CONFIG_TABLE/false/0`}
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

  const onSubmit = () => {
    const { dispatch } = props
    const formData = ComponentManager.getStateForComponent(`${tableName}_FORM`, 'formTableData');
    dispatch({ type: 'ADD_ADM_CONSOLE_FORM_DATA', payload: { ...formData, recordType: 'TABLE' } })
    alertUserV2({
      type: 'info',
      title: intl.formatMessage({ id: 'perun.admin_console.table_change_confirmed', defaultMessage: 'perun.admin_console.table_change_confirmed' }),
    })
  }

  const generateSvarogTableForm = (objectId) => {
    const { svSession } = props
    return (
      <GenericForm
        params={'READ_URL'}
        key={`${tableName}_FORM`}
        id={`${tableName}_FORM`}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${tableName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${tableName}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${objectId}/${tableName}`}
        customSave
        customSaveButtonName={intl.formatMessage({ id: 'perun.admin_console.confirm_changes', defaultMessage: 'perun.admin_console.confirm_changes' })}
        addSaveFunction={onSubmit}
        hideBtns='closeAndDelete'
        className={'admin-settings-forms'}
        uiSchemaOverride={TABLE_UISCHEMA_OVERRIDE}
        additionalWidgets={TABLE_ADDITIONAL_WIDGETS}
        inputWrapper={SvarogTableFormWrapper}
        objectId={objectId}
        selectedTableName={selectedTableName}
        onClose={doClose}
      />
    )
  }

  const doClose = () => {
    setState({ show: false })
    props.dispatch({ type: 'CLEAN_ADM_CONSOLE_FORM_DATA' })
  }

  const onHide = () => {
    if (props.admConsoleFormData.length > 0) {
      alertUserV2({
        type: 'warning',
        title: fmt('perun.admin_console.unsaved_changes_warning'),
        showCancel: true,
        cancelButtonText: fmt('perun.admin_console.cancel'),
        confirmButtonText: fmt('perun.admin_console.discard_and_close'),
        confirmButtonColor: '#dc2626',
        onConfirm: doClose,
      })
      return
    }
    doClose()
  }

  return (
    <>
      {loading && <Loading />}
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{intl.formatMessage({ id: 'perun.admin_console.svarog_tables', defaultMessage: 'perun.admin_console.svarog_tables' })}</p>
          <AdminConsoleHelpButton title={{ id: 'perun.admin_console.svarog_tables', defaultMessage: 'perun.admin_console.svarog_tables' }} />
        </div>
        {generateSvarogTablesGrid()}
      </div>
      {show && (
        <Modal className='admin-console-unit-modal sf-table-modal' show={show} onHide={onHide}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generateSvarogTableForm(objectId)}
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
  admConsoleFormData: state.admConsoleFormData,
})

export default connect(mapStateToProps)(SvarogTables)
