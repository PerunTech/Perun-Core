import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import axios from 'axios'
import { ComponentManager, ExportableGrid, GenericForm } from '../../client'
import { alertUserResponse, ReactBootstrap } from '../../elements'
import SystemConfLogsWrapper from './SystemConfLogsWrapper'
import { Loading } from '../ComponentsIndex'
import AdminConsoleHelpButton from './Help/AdminConsoleHelpButton'
const { useReducer, useEffect } = React
const { Modal } = ReactBootstrap

const LogTextWidget = ({ value }) => (
  <pre className='conf-log-note-text'>{value || ''}</pre>
)

const LabelWidget = ({ value }) => (
  <strong className='conf-log-note-name'>{value || ''}</strong>
)

const SystemConfLogs = (props) => {
  const intl = useIntl()
  const initialState = {
    loading: false, tableName: 'SVAROG_CONFIG_LOG', formTableName: 'SVAROG_NOTES', gridId: 'SVAROG_CONFIG_LOG_GRID', gridConfig: undefined, show: false, objectId: 0
  }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, tableName, formTableName, gridId, gridConfig, show, objectId }, setState] = useReducer(reducer, initialState)

  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId)
    }
  }, [gridId])

  useEffect(() => {
    getAndExtendFieldList()
  }, [])

  const getAndExtendFieldList = () => {
    setState({ loading: true })
    const { svSession } = props
    const url = `${window.server}/ReactElements/getTableFieldList/${svSession}/${tableName}`
    axios.get(url).then(res => {
      setState({ loading: false })
      const fields = Array.isArray(res.data) ? res.data : res.data?.data || []
      const dtInsertField = {
        key: `${tableName}.DT_INSERT`,
        TABLE_NAME: tableName,
        FIELD_NAME: 'DT_INSERT',
        name: intl.formatMessage({ id: 'perun.grid_labels.svarog_config_log.dt_insert', defaultMessage: 'perun.grid_labels.svarog_config_log.dt_insert' }),
        filterable: true,
        resizable: true
      }
      setState({ gridConfig: [...fields, dtInsertField] })
    }).catch(err => {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    })
  }

  const handleRowClick = (_id, _rowIdx, row) => {
    setState({ objectId: row[`${tableName}.OBJECT_ID`] || 0, show: true })
  }

  const generateConfLogGrid = () => {
    return (
      <ExportableGrid
        gridType='SEARCH_GRID_DATA'
        key={gridId}
        id={gridId}
        configTableName={gridConfig}
        dataTableName={`/ReactElements/getFullTableData/${props.svSession}/${tableName}/0/false`}
        onRowClickFunct={handleRowClick}
        refreshData={true}
        heightRatio={0.75}
      />
    )
  }

  const generateConfLogForm = (objectId) => {
    const { svSession } = props
    return (
      <GenericForm
        params={'READ_URL'}
        key={`${formTableName}_FORM`}
        id={`${formTableName}_FORM`}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${formTableName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${formTableName}`}
        tableFormDataMethod={`/ReactElements/getFormDataByParentId/${svSession}/${objectId}/${formTableName}`}
        hideBtns='all'
        className={'admin-settings-forms conf-log-preview-form'}
        inputWrapper={SystemConfLogsWrapper}
        additionalWidgets={{ logText: LogTextWidget, label: LabelWidget }}
        uiSchemaOverride={{ NOTE_TEXT: { 'ui:widget': 'logText' }, NOTE_NAME: { 'ui:widget': 'label' } }}
        disableHelpButtons
      />
    )
  }

  return (
    <>
      {loading && <Loading />}
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{intl.formatMessage({ id: 'perun.admin_console.svarog_config_log', defaultMessage: 'perun.admin_console.svarog_config_log' })}</p>
          <AdminConsoleHelpButton title={{ id: 'perun.admin_console.svarog_config_log', defaultMessage: 'perun.admin_console.svarog_config_log' }} />
        </div>
        {gridConfig && generateConfLogGrid()}
      </div>
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => setState({ show: false })}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
            <Modal.Title>
              {intl.formatMessage({ id: 'perun.system.logs.preview', defaultMessage: 'perun.system.logs.preview' })}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generateConfLogForm(objectId)}
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  )
}

const mapStateToProps = state => ({
  svSession: state.security.svSession
})

export default connect(mapStateToProps)(SystemConfLogs)
