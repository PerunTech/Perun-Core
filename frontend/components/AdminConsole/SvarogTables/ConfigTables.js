import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, GridManager, Loading, axios } from '../../../client'
import { alertUserResponse, alertUserV2, Icon, ReactBootstrap } from '../../../elements'
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton'

import SvarogTableFormWrapper from './SvarogTableFormWrapper'
import { TABLE_UISCHEMA_OVERRIDE, downloadJson, fetchInBatches } from './svarogTableUtils'
import CustomCheckboxWidget from './CustomCheckboxWidget'
import PerunMenuWrapper from '../PerunMenu/PerunMenuWrapper'
import SvarogMenuWrapper from '../SvarogMenuWrapper'
import ConfigMenuWrapper from '../ConfigMenuWrapper'
import SystemConfLogsWrapper from '../SystemConfLogsWrapper'
import SysParamsWrapper from './SysParamsWrapper'

const TABLE_ADDITIONAL_WIDGETS = { CustomCheckboxWidget }

const RECORD_WRAPPERS = {
  PERUN_MENU: PerunMenuWrapper,
  SVAROG_MENU: SvarogMenuWrapper,
  SVAROG_PERUN_PLUGIN: ConfigMenuWrapper,
  SVAROG_SYS_PARAMS: SysParamsWrapper,
}

const CONF_LOG_WIDGETS = {
  logText: ({ value }) => <pre className='conf-log-note-text'>{value || ''}</pre>,
  label: ({ value }) => <strong className='conf-log-note-name'>{value || ''}</strong>,
}
const CONF_LOG_UISCHEMA = { NOTE_TEXT: { 'ui:widget': 'logText' }, NOTE_NAME: { 'ui:widget': 'label' } }
const { useReducer, useEffect, useRef } = React
const { Modal } = ReactBootstrap

const TABLE_NAME = 'SVAROG_TABLES'
const GRID_ID = 'CONFIG_TABLES_GRID'
const RECORDS_EXPORT_BATCH_SIZE = 15

const ConfigTables = (props, context) => {
  const fmt = (id) => context.intl.formatMessage({ id, defaultMessage: id })

  const initialState = {
    show: false, objectId: 0, selectedTableName: '',
    activeTab: 'definition', showRecordModal: false, recordObjectId: 0,
    selectedTableRows: [], loading: false,
  }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ show, objectId, selectedTableName, activeTab, showRecordModal, recordObjectId, selectedTableRows, loading }, setState] = useReducer(reducer, initialState)

  useEffect(() => {
    return () => { ComponentManager.cleanComponentReducerState(GRID_ID) }
  }, [])

  const selectedTableRowsRef = useRef(selectedTableRows)
  selectedTableRowsRef.current = selectedTableRows

  const tableFormId = `${TABLE_NAME}_FORM`
  const recordsGridId = selectedTableName ? `${selectedTableName}_RECORDS_GRID` : ''
  const recordFormId = `CONFIG_RECORD_FORM_${selectedTableName}_${recordObjectId}`

  const handleRowClick = (_id, _rowIdx, row) => {
    setState({
      objectId: row[`${TABLE_NAME}.OBJECT_ID`] || 0,
      selectedTableName: row[`${TABLE_NAME}.TABLE_NAME`] || '',
      show: true,
      activeTab: 'definition',
    })
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

  const onTableSubmit = () => {
    const formData = ComponentManager.getStateForComponent(tableFormId, 'formTableData')
    props.dispatch({ type: 'ADD_ADM_CONSOLE_FORM_DATA', payload: { ...formData, recordType: 'TABLE' } })
    alertUserV2({ type: 'info', title: fmt('perun.admin_console.table_change_confirmed') })
  }

  const saveRecord = (e) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(recordFormId, null, { saveExecuted: false })
    const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/${selectedTableName}/0`
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
          GridManager.reloadGridData(recordsGridId)
          setState({ showRecordModal: false })
        }
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err, onConfirm })
    })
  }

  const deleteRecord = (_id, _action, _session, formData) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(recordFormId, null, { deleteExecuted: false })
    const url = `${window.server}/ReactElements/deleteObject/${svSession}`
    axios({
      method: 'post',
      data: encodeURIComponent(formData[4]['PARAM_VALUE']),
      url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((res) => {
      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ type: resType, response: res, onConfirm })
        if (resType === 'success') {
          GridManager.reloadGridData(recordsGridId)
          setState({ showRecordModal: false })
        }
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err, onConfirm })
    })
  }

  const handleRecordRowClick = (_id, _rowIdx, row) => {
    setState({ recordObjectId: row[`${selectedTableName}.OBJECT_ID`] || 0, showRecordModal: true })
  }

  const exportSelectedTables = () => {
    const rows = selectedTableRowsRef.current
    if (rows.length === 0) {
      alertUserV2({ type: 'info', title: fmt('perun.admin_console.no_rows_selected') })
      return
    }
    setState({ loading: true })
    const { svSession } = props
    const fetches = rows.map(row => {
      const objId = row[`${TABLE_NAME}.OBJECT_ID`]
      return Promise.all([
        axios.get(`${window.server}/WsCore/children/${svSession}/${objId}/SVAROG_FIELDS`),
        axios.get(`${window.server}/WsCore/object/${svSession}/${objId}/SVAROG_TABLES`),
      ])
    })
    Promise.all(fetches).then(results => {
      results.forEach(([fieldsRes, tableRes], i) => {
        const items = []
        if (tableRes?.data) {
          const tableItems = Array.isArray(tableRes.data) ? tableRes.data : [tableRes.data]
          items.push(...tableItems)
        }
        const dbDataArray = fieldsRes?.data?.['com.prtech.svarog_common.DbDataArray']
        if (dbDataArray?.items) items.push(...dbDataArray.items)
        const exportData = {
          'com.prtech.svarog_common.DbDataArray': { indexField: null, filter: null, items, idxItems: [] }
        }
        downloadJson(exportData, rows[i][`${TABLE_NAME}.TABLE_NAME`] || 'CONFIG_TABLES_EXPORT')
      })
      setState({ loading: false })
    }).catch(err => {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    })
  }

  const exportTableRecords = () => {
    const rows = ComponentManager.getStateForComponent(recordsGridId, 'rows') || []
    setState({ loading: true })
    const { svSession } = props
    const toItems = (data) => (Array.isArray(data) ? data : data ? [data] : [])
    Promise.all([
      fetchInBatches(rows, RECORDS_EXPORT_BATCH_SIZE, row => {
        const rowObjectId = row[`${selectedTableName}.OBJECT_ID`]
        return axios.get(`${window.server}/WsCore/object/${svSession}/${rowObjectId}/${selectedTableName}`)
      }),
      axios.get(`${window.server}/WsCore/object/${svSession}/${objectId}/SVAROG_TABLES`),
    ]).then(([recordResults, tableRes]) => {
      const items = [...toItems(tableRes?.data)]
      recordResults.forEach(recordRes => items.push(...toItems(recordRes?.data)))
      const exportData = {
        'com.prtech.svarog_common.DbDataArray': { indexField: null, filter: null, items, idxItems: [] }
      }
      downloadJson(exportData, selectedTableName || 'CONFIG_TABLE_RECORDS_EXPORT')
      setState({ loading: false })
    }).catch(err => {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    })
  }

  const generateTableDefinitionTab = () => {
    const { svSession } = props
    return (
      <GenericForm
        params='READ_URL'
        key={tableFormId}
        id={tableFormId}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${TABLE_NAME}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${TABLE_NAME}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${objectId}/${TABLE_NAME}`}
        customSave
        customSaveButtonName={fmt('perun.admin_console.confirm_changes')}
        addSaveFunction={onTableSubmit}
        hideBtns='closeAndDelete'
        className='admin-settings-forms'
        uiSchemaOverride={TABLE_UISCHEMA_OVERRIDE}
        additionalWidgets={TABLE_ADDITIONAL_WIDGETS}
        inputWrapper={SvarogTableFormWrapper}
        objectId={objectId}
        selectedTableName={selectedTableName}
        onClose={doClose}
        helpSectionId={TABLE_NAME}
      />
    )
  }

  const generateRecordsTab = () => {
    const { svSession } = props
    return (
      <div className='ct-records-tab'>
        <div className='svarog-table-buttons-container'>
          <button className='btn-success btn_save_form svarog-table-export-btn' onClick={exportTableRecords}>
            {fmt('perun.admin_console.export_table_and_records')}
            <span className='download-span'>{<Icon name='IconDatabaseExport' />}</span>
          </button>
        </div>
        <ExportableGrid
          gridType='READ_URL'
          key={recordsGridId}
          id={recordsGridId}
          configTableName={`/ReactElements/getTableFieldList/${svSession}/${selectedTableName}`}
          dataTableName={`/ReactElements/getTableData/${svSession}/${selectedTableName}/0`}
          onRowClickFunct={handleRecordRowClick}
          refreshData={true}
          toggleCustomButton={selectedTableName !== 'SVAROG_CONFIG_LOG'}
          customButton={() => setState({ recordObjectId: 0, showRecordModal: true })}
          customButtonLabel={fmt('perun.admin_console.add')}
          heightRatio={0.6}
          editContextFunc={handleRecordRowClick}
        />
      </div>
    )
  }

  const generateRecordModal = () => {
    const { svSession } = props
    const isConfLog = selectedTableName === 'SVAROG_CONFIG_LOG'
    const formTableName = isConfLog ? 'SVAROG_NOTES' : selectedTableName
    return (
      <Modal className='admin-console-unit-modal' show={showRecordModal} onHide={() => setState({ showRecordModal: false })}>
        <Modal.Header className='admin-console-unit-modal-header' closeButton />
        <Modal.Body className='admin-console-unit-modal-body'>
          <GenericForm
            params='READ_URL'
            key={recordFormId}
            id={recordFormId}
            method={`/ReactElements/getTableJSONSchema/${svSession}/${formTableName}`}
            uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${formTableName}`}
            tableFormDataMethod={isConfLog
              ? `/ReactElements/getFormDataByParentId/${svSession}/${recordObjectId}/${formTableName}`
              : `/ReactElements/getTableFormData/${svSession}/${recordObjectId}/${selectedTableName}`}
            addSaveFunction={isConfLog ? undefined : (e) => saveRecord(e)}
            hideBtns={isConfLog ? 'all' : (recordObjectId === 0 ? 'closeAndDelete' : 'close')}
            addDeleteFunction={isConfLog ? undefined : deleteRecord}
            className={isConfLog ? 'admin-settings-forms conf-log-preview-form' : 'admin-settings-forms'}
            inputWrapper={isConfLog ? SystemConfLogsWrapper : RECORD_WRAPPERS[selectedTableName]}
            additionalWidgets={isConfLog ? CONF_LOG_WIDGETS : undefined}
            uiSchemaOverride={isConfLog ? CONF_LOG_UISCHEMA : undefined}
            objectId={recordObjectId}
            helpSectionId={isConfLog ? undefined : formTableName}
            disableHelpButtons={isConfLog}
          />
        </Modal.Body>
        <Modal.Footer className='admin-console-unit-modal-footer' />
      </Modal>
    )
  }

  return (
    <>
      {loading && <Loading />}
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{fmt('perun.admin_console.svarog_config_tables')}</p>
          <AdminConsoleHelpButton title={{ id: 'perun.admin_console.svarog_config_tables', defaultMessage: 'perun.admin_console.svarog_config_tables' }} />
        </div>
        <ExportableGrid
          gridType='READ_URL'
          key={GRID_ID}
          id={GRID_ID}
          configTableName={`/ReactElements/getTableFieldList/${props.svSession}/${TABLE_NAME}`}
          dataTableName={`/ReactElements/getTableWithFilter/${props.svSession}/SVAROG_TABLES/IS_CONFIG_TABLE/true/0`}
          onRowClickFunct={handleRowClick}
          refreshData={true}
          enableMultiSelect={true}
          onSelectChangeFunct={(rows) => setState({ selectedTableRows: rows })}
          buttonsArray={[
            { id: 'add_config_table', name: fmt('perun.admin_console.add'), action: () => setState({ show: true, objectId: 0, activeTab: 'definition' }) },
            { id: 'export_selected_config_tables', name: fmt('perun.admin_console.export_selected'), action: exportSelectedTables },
          ]}
          heightRatio={0.75}
          editContextFunc={handleRowClick}
        />
      </div>
      {show && (
        <Modal className='admin-console-unit-modal sf-table-modal' show={show} onHide={onHide}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton />
          <Modal.Body className='admin-console-unit-modal-body'>
            <div className='ct-tabs'>
              <button
                className={`ct-tab${activeTab === 'definition' ? ' ct-tab--active' : ''}`}
                onClick={() => setState({ activeTab: 'definition' })}
              >
                {fmt('perun.admin_console.table_definition')}
              </button>
              {objectId !== 0 && (
                <button
                  className={`ct-tab${activeTab === 'records' ? ' ct-tab--active' : ''}`}
                  onClick={() => setState({ activeTab: 'records' })}
                >
                  {fmt('perun.admin_console.records')}
                </button>
              )}
            </div>
            {activeTab === 'definition' && generateTableDefinitionTab()}
            {activeTab === 'records' && generateRecordsTab()}
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer' />
        </Modal>
      )}
      {showRecordModal && generateRecordModal()}
    </>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
  admConsoleFormData: state.admConsoleFormData,
})

ConfigTables.contextTypes = {
  intl: PropTypes.object.isRequired
}

export default connect(mapStateToProps)(ConfigTables)
