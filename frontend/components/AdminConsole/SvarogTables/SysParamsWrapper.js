import React from 'react'
import PropTypes from 'prop-types'
import { JsonEditor } from '../../JsonEditor'
import { ReactBootstrap, alertUserV2, ComponentManager, Icon } from '../../../elements'
import { isJSON } from '../../../functions/utils'

const { useState } = React
const { Modal } = ReactBootstrap

const PARAM_VALUE_FIELD = 'PARAM_VALUE'

// SVAROG_SYS_PARAMS.PARAM_VALUE can hold a plain scalar or a JSON-encoded object/array (as a
// string). The field itself stays a normal, always-editable text input; the button opens a
// JsonEditor modal seeded with the current value parsed (or an empty object, if it isn't valid
// JSON yet) for composing/editing it as JSON, and writes the result back as a stringified value.
const SysParamsWrapper = (props, context) => {
  const fmt = (id) => context.intl.formatMessage({ id, defaultMessage: id })
  const { formid, formInstance } = props

  const [show, setShow] = useState(false)
  const [fieldJson, setFieldJson] = useState({})

  const getFormTableData = () => ComponentManager.getStateForComponent(formid, 'formTableData') || {}

  const openJsonEditor = () => {
    const raw = getFormTableData()[PARAM_VALUE_FIELD]
    setFieldJson(isJSON(raw) ? JSON.parse(raw) : {})
    setShow(true)
  }

  const changeJson = (editedJson) => {
    const onConfirm = () => {
      const updated = { ...getFormTableData(), [PARAM_VALUE_FIELD]: JSON.stringify(editedJson) }
      ComponentManager.setStateForComponent(formid, 'formTableData', updated)
      formInstance.setState({ formTableData: updated })
      setShow(false)
    }
    alertUserV2({
      type: 'info',
      title: fmt('perun.admin_console.change_json'),
      onConfirm,
    })
  }

  return (
    <>
      <div className='svarog-table-buttons-container'>
        <button type='button' className='btn-success btn_save_form svarog-table-export-btn sys-params-json-btn' onClick={openJsonEditor}>
          {fmt('perun.admin_console.edit_param_as_json')}
          <span className='sys-params-btn-icon'><Icon name='IconJson' /></span>
        </button>
      </div>
      {props.children}
      {show && (
        <Modal className='admin-console-unit-modal menu-editor-modal' show={show} onHide={() => setShow(false)}>
          <Modal.Header className='admin-console-unit-modal-header menu-editor-header' closeButton />
          <Modal.Body className='admin-console-unit-modal-body menu-editor-body'>
            <JsonEditor value={fieldJson} onSave={changeJson} />
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer menu-editor-footer' />
        </Modal>
      )}
    </>
  )
}

SysParamsWrapper.contextTypes = {
  intl: PropTypes.object.isRequired,
}

export default SysParamsWrapper
