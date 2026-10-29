import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { Loading } from '../../ComponentsIndex'
import { ComponentManager, GenericForm, axios } from '../../../client'
import { ReactBootstrap, Icon, alertUserResponse, alertUserV2 } from '../../../elements'
import { JsonEditor } from '../../JsonEditor'
import SvarogFieldsPanel from './SvarogFieldsPanel'
import { parseDbDataArray, normalizeField, formDataToDbDataObject, applyFormDataOverrides, downloadJson, FIELD_UISCHEMA_OVERRIDE, isTrue, FLAG_META } from './svarogTableUtils'
import InvertedMandatoryCheckbox from './InvertedMandatoryCheckbox'
import GuiMetadataWidget from './GuiMetadataWidget'

const FIELD_ADDITIONAL_WIDGETS = { InvertedMandatoryCheckbox }
const { useReducer, useEffect, useRef } = React
const { Modal } = ReactBootstrap

const SvarogTableFormWrapper = (props) => {
  const intl = useIntl()
  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id })
  const initialState = {
    loading: false, objectId: undefined,
    tableName: 'SVAROG_FIELDS', selectedFieldObjectId: undefined, selectedTableName: '',
    exportPreview: null, exportServerJson: null, exportFileName: '',
    serverFields: [], fieldsLoading: false, editingTable: false, guiMetadata: undefined,
  }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, objectId, tableName, selectedFieldObjectId, selectedTableName,
    exportPreview, exportServerJson, exportFileName, serverFields, fieldsLoading, editingTable, guiMetadata }, setState] = useReducer(reducer, initialState)

  const guiMetadataRef = useRef(guiMetadata)
  guiMetadataRef.current = guiMetadata

  useEffect(() => {
    getObjectId()
  }, [])

  useEffect(() => {
    if (!objectId || objectId === ' ') return
    setState({ fieldsLoading: true })
    const { svSession } = props
    // WsCore/children returns the full DbDataObject structure needed for field metadata.
    // getObjectsByParentId is kept alongside it because it translates LABEL_CODE server-side;
    // WsCore/children returns the raw i18n key which is not in the client message bundle.
    const childrenUrl = `${window.server}/WsCore/children/${svSession}/${objectId}/SVAROG_FIELDS`
    const legacyUrl = `${window.server}/ReactElements/getObjectsByParentId/${svSession}/${objectId}/${tableName}/0`
    Promise.all([axios.get(childrenUrl), axios.get(legacyUrl)]).then(([childrenRes, legacyRes]) => {
      const fields = parseDbDataArray(childrenRes?.data)
      const labelMap = {}
      if (Array.isArray(legacyRes?.data)) {
        for (const row of legacyRes.data) {
          const n = normalizeField(row)
          if (n.OBJECT_ID != null) labelMap[n.OBJECT_ID] = n.LABEL_CODE
        }
      }
      // Patch translated labels onto the structured fields from the children endpoint
      const merged = fields.map(f => labelMap[f.OBJECT_ID] != null ? { ...f, LABEL_CODE: labelMap[f.OBJECT_ID] } : f)
      setState({ serverFields: merged, fieldsLoading: false })
    }).catch((err) => {
      setState({ fieldsLoading: false })
      alertUserResponse({ response: err })
    })
  }, [objectId])

  const getObjectId = () => {
    const { formid } = props
    const objectId = ComponentManager.getStateForComponent(formid, 'objectId')
    const selectedTableName = ComponentManager.getStateForComponent(formid, 'selectedTableName')
    setState({ objectId: objectId || ' ', selectedTableName: selectedTableName || '' })
  }

  const mergedFields = (() => {
    const overrides = props.admConsoleFormData.filter(item => item.recordType === 'FIELD')
    const deletedIds = new Set(overrides.filter(f => f.deleted && f.OBJECT_ID).map(f => f.OBJECT_ID))
    const base = serverFields
      .filter(f => !deletedIds.has(f.OBJECT_ID))
      .map(f => {
        const override = overrides.find(o => o.OBJECT_ID === f.OBJECT_ID && !o.deleted)
        return override ? { ...f, ...override, _pending: true } : f
      })
    const newFields = overrides.filter(f => !f.OBJECT_ID && !f.deleted)
    return [...base, ...newFields.map(f => ({ ...f, _pending: true, _new: true }))]
      .sort((a, b) => (a.SORT_ORDER || 0) - (b.SORT_ORDER || 0))
  })()

  const { userId } = props.userInfo

  const isNew = objectId === ' '
  const showEditForm = editingTable || isNew

  const tableData = ComponentManager.getStateForComponent(props.formid, 'formTableData')
  const tableOverride = props.admConsoleFormData.find(item => item.recordType === 'TABLE')
  const mergedTableData = tableOverride ? { ...(tableData || {}), ...tableOverride } : tableData
  const qualifier = [mergedTableData?.SCHEMA, mergedTableData?.REPO_NAME].filter(Boolean).join(' / ')

  const cacheTypeLabel = (() => {
    const cacheType = mergedTableData?.CACHE_TYPE
    if (!cacheType) return null
    const jsonSchema = ComponentManager.getStateForComponent(props.formid, 'formData')
    const cacheTypeCodelist = jsonSchema?.properties?.CACHE_TYPE
    const index = cacheTypeCodelist?.enum?.indexOf(cacheType)
    const key = index >= 0 ? cacheTypeCodelist?.enumNames?.[index] : null
    return key ? fmt(key) : cacheType
  })()

  const exportJson = () => {
    if (!objectId || objectId === ' ') {
      if (props.admConsoleFormData.length === 0) {
        alertUserV2({
          type: 'info',
          title: fmt('perun.admin_console.nothing_to_export'),
        })
      } else {
        const tableFormData = props.admConsoleFormData.find(item => item.recordType === 'TABLE')
        const fieldFormDataEntries = props.admConsoleFormData.filter(item => item.recordType === 'FIELD' && !item.deleted)
        const items = fieldFormDataEntries.map(fd => formDataToDbDataObject(fd, userId))
        if (tableFormData) {
          items.unshift(formDataToDbDataObject(tableFormData, userId))
        }
        const exportData = {
          'com.prtech.svarog_common.DbDataArray': {
            indexField: null,
            filter: null,
            items,
            idxItems: []
          }
        }
        setState({ exportPreview: exportData, exportServerJson: null, exportFileName: tableFormData?.TABLE_NAME || 'EXPORT_TABLE' })
      }
    } else {
      setState({ loading: true })
      const { svSession } = props
      const fieldsUrl = `${window.server}/WsCore/children/${svSession}/${objectId}/SVAROG_FIELDS`
      const tableUrl = `${window.server}/WsCore/object/${svSession}/${objectId}/SVAROG_TABLES`

      Promise.all([
        axios.get(fieldsUrl),
        axios.get(tableUrl)
      ]).then(([fieldsRes, tableRes]) => {
        setState({ loading: false })
        const fieldsData = Array.isArray(fieldsRes?.data) ? fieldsRes.data : fieldsRes?.data ? [fieldsRes.data] : []
        const tableData = tableRes?.data
        const serverJson = fieldsData[0] ? JSON.parse(JSON.stringify(fieldsData[0])) : null
        const dbDataArray = fieldsData[0]?.['com.prtech.svarog_common.DbDataArray']
        if (dbDataArray && Array.isArray(dbDataArray.items)) {
          const deletedFieldIds = props.admConsoleFormData
            .filter(item => item.recordType === 'FIELD' && item.deleted)
            .map(item => item.OBJECT_ID)
          if (deletedFieldIds.length > 0) {
            dbDataArray.items = dbDataArray.items.filter(item => {
              const dbObj = item['com.prtech.svarog_common.DbDataObject']
              return !dbObj || !deletedFieldIds.includes(dbObj.object_id)
            })
          }
          const fieldOverrides = props.admConsoleFormData.filter(item => item.recordType === 'FIELD')
          applyFormDataOverrides(dbDataArray.items, fieldOverrides)
          const newFields = props.admConsoleFormData.filter(item => item.recordType === 'FIELD' && !item.OBJECT_ID && !item.deleted)
          if (newFields.length > 0) {
            dbDataArray.items.push(...newFields.map(fd => formDataToDbDataObject(fd, userId)))
          }
          if (tableData) {
            const tableItem = Array.isArray(tableData) ? tableData : [tableData]
            const serverDbDataArray = serverJson?.['com.prtech.svarog_common.DbDataArray']
            if (serverDbDataArray) {
              serverDbDataArray.items.unshift(...JSON.parse(JSON.stringify(tableItem)))
            }
            const tableOverrides = props.admConsoleFormData.filter(item => item.recordType === 'TABLE')
            applyFormDataOverrides(tableItem, tableOverrides)
            dbDataArray.items.unshift(...tableItem)
          }
        }
        const exportData = fieldsData[0] || {}
        const hasOverrides = props.admConsoleFormData.length > 0
        setState({
          exportPreview: exportData,
          exportServerJson: hasOverrides ? serverJson : null,
          exportFileName: selectedTableName
        })
      }).catch(err => {
        console.error(err)
        setState({ loading: false })
        alertUserResponse({ response: err })
      })
    }
  }

  const handleExportSave = (json) => {
    downloadJson(json, exportFileName)
    const onClose = ComponentManager.getStateForComponent(props.formid, 'onClose')
    if (onClose) onClose()
  }

  const fieldFormId = `SVAROG_FIELDS_FORM_${selectedFieldObjectId}`

  const onDelete = () => {
    const { dispatch } = props
    const formData = ComponentManager.getStateForComponent(fieldFormId, 'formTableData')
    dispatch({ type: 'ADD_ADM_CONSOLE_FORM_DATA', payload: { ...formData, OBJECT_ID: selectedFieldObjectId, recordType: 'FIELD', deleted: true } })
    alertUserV2({
      type: 'info',
      title: fmt('perun.admin_console.field_deleted'),
    })
    setState({ selectedFieldObjectId: undefined })
  }

  const onSubmit = () => {
    const { dispatch } = props
    const formData = ComponentManager.getStateForComponent(fieldFormId, 'formTableData')
    dispatch({ type: 'ADD_ADM_CONSOLE_FORM_DATA', payload: { ...formData, OBJECT_ID: selectedFieldObjectId, GUI_METADATA: guiMetadataRef.current, recordType: 'FIELD' } })
    alertUserV2({
      type: 'info',
      title: fmt('perun.admin_console.field_change_confirmed'),
    })
  }

  const generateFieldForm = () => {
    const { svSession } = props
    return (
      <GenericForm
        params={'READ_URL'}
        key={fieldFormId}
        id={fieldFormId}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${tableName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${tableName}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${selectedFieldObjectId}/${tableName}`}
        customSave
        addSaveFunction={onSubmit}
        hideBtns={true}
        buttonsArray={[]}
        className={'admin-settings-forms'}
        additionalWidgets={FIELD_ADDITIONAL_WIDGETS}
        uiSchemaOverride={FIELD_UISCHEMA_OVERRIDE}
      />
    )
  }

  return (
    <>
      {loading && <Loading />}
      <div className='svarog-table-buttons-container'>
        <button className='btn-success btn_save_form svarog-table-export-btn' onClick={exportJson}>
          {fmt('perun.admin_console.export_table_and_fields')}
          <span className='download-span'>{<Icon name='IconDatabaseExport' />}</span>
        </button>
      </div>
      {!editingTable && !isNew && mergedTableData?.TABLE_NAME && (
        <div className='stp-card'>
          <div className='stp-header'>
            <span className='stp-table-name'>{mergedTableData.TABLE_NAME}</span>
            {qualifier && <span className='stp-qualifier'>{qualifier}</span>}
            <button className='stp-edit-btn' onClick={() => setState({ editingTable: true })} title='Edit table'>
              <Icon name='IconPencil' size={18} />
            </button>
          </div>
          <div className='stp-meta-row'>
            {mergedTableData.LABEL_CODE && <span className='stp-label-code'>{mergedTableData.LABEL_CODE}</span>}
            <div className='stp-badges'>
              {FLAG_META.filter(f => isTrue(mergedTableData[f.key])).map(f => (
                <span key={f.key} className='stp-badge' style={{ background: f.color }}>{f.label}</span>
              ))}
              {isTrue(mergedTableData.USE_CACHE) && (
                <span className='stp-badge stp-badge--cache'>
                  CACHE{cacheTypeLabel ? `: ${cacheTypeLabel}` : ''}
                  {mergedTableData.CACHE_SIZE ? ` · ${mergedTableData.CACHE_SIZE}` : ''}
                  {mergedTableData.CACHE_EXPIRY ? ` · ${mergedTableData.CACHE_EXPIRY}s` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div className={showEditForm ? 'stp-card stp-card--editing' : undefined} style={showEditForm ? undefined : { display: 'none' }}>
        {props.children}
        {showEditForm && (
          <div className='stp-edit-actions'>
            <button type='submit' form={props.formid} className='stp-btn stp-btn--save'>
              <Icon name='IconCheck' size={14} />
            </button>
            {!isNew && (
              <button type='button' className='stp-btn stp-btn--cancel' onClick={() => setState({ editingTable: false })}>
                <Icon name='IconX' size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      {objectId && (
        <div className='sf-split-panel'>
          <div className='sf-entity-box'>
            <div className='sf-entity-box-header'>
              <span>{fmt('perun.admin_console.svarog_fields')}</span>
              <span className='sf-field-count'>{mergedFields.length}</span>
            </div>
            {fieldsLoading
              ? <Loading />
              : (
                <SvarogFieldsPanel
                  fields={mergedFields}
                  selectedObjectId={selectedFieldObjectId}
                  onSelect={(oid) => {
                    const field = mergedFields.find(f => f.OBJECT_ID === oid)
                    setState({ selectedFieldObjectId: oid, guiMetadata: field?.GUI_METADATA || undefined })
                  }}
                  onAdd={() => setState({ selectedFieldObjectId: 0, guiMetadata: undefined })}
                  addLabel={fmt('perun.admin_console.add')}
                />
              )
            }
          </div>
          <div className='sf-form-panel'>
            {selectedFieldObjectId !== undefined
              ? (
                <>
                  <div className='sf-form-panel-toolbar'>
                    {selectedFieldObjectId !== 0 && (
                      <button type='button' className='btn-danger btn_delete_form' onClick={onDelete}>
                        {fmt('perun.admin_console.delete_field')}
                      </button>
                    )}
                    <div className='sf-form-panel-toolbar-right'>
                      <button type='submit' form={fieldFormId} className='btn-success btn_save_form'>
                        {fmt('perun.admin_console.confirm_changes')}
                      </button>
                      <button
                        className='sf-form-close-btn'
                        title={fmt('perun.main.forms.close')}
                        onClick={() => setState({ selectedFieldObjectId: undefined })}
                      >
                        <Icon name='IconX' size={16} />
                      </button>
                    </div>
                  </div>
                  <div className='sf-form-panel-fields'>
                    {generateFieldForm()}
                  </div>
                  <div className='sf-gui-meta-section'>
                    <span className='sf-gui-meta-label'>{fmt('perun.admin_console.gui_metadata')}</span>
                    <GuiMetadataWidget
                      key={selectedFieldObjectId}
                      value={guiMetadata}
                      onChange={(val) => setState({ guiMetadata: val })}
                      fmt={fmt}
                    />
                  </div>
                </>
              )
              : (
                <div className='sf-no-selection'>
                  {mergedFields.length === 0
                    ? fmt('perun.admin_console.add_or_select_field_to_edit')
                    : fmt('perun.admin_console.select_field_to_edit')
                  }
                </div>
              )
            }
          </div>
        </div>
      )}
      {exportPreview && (
        <Modal
          className='admin-console-unit-modal menu-editor-modal'
          show={!!exportPreview}
          onHide={() => setState({ exportPreview: null, exportServerJson: null, exportFileName: '' })}
        >
          <Modal.Header className='admin-console-unit-modal-header menu-editor-header' closeButton>
            <Modal.Title>{exportFileName}</Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body menu-editor-body'>
            <JsonEditor
              value={exportPreview}
              originalValue={exportServerJson}
              onDownload={handleExportSave}
            />
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer menu-editor-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
  admConsoleFormData: state.admConsoleFormData,
  userInfo: state.userInfo,
})

export default connect(mapStateToProps)(SvarogTableFormWrapper)
