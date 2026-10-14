import React from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import axios from 'axios';
import { JsonEditor } from '../JsonEditor';
import { ReactBootstrap, alertUserV2, alertUserResponse, ComponentManager, GridManager } from '../../elements';
import { isJSON } from '../../functions/utils';
const { useState, useEffect } = React;
const { Modal } = ReactBootstrap;

const SvarogMenuWrapper = (props) => {
  const intl = useIntl()
  const [show, setShow] = useState(false);
  const [shouldRender, setRender] = useState(false)
  const [fieldJson, setFieldJson] = useState({})
  useEffect(() => {
    changeField()
  }, [])

  useEffect(() => {
    if (shouldRender) {
      handleInput()
    }
  }, [shouldRender])

  const handleInput = () => {
    const firstInput = document.getElementById("root_MENU_CONF");
    if (firstInput) {
      firstInput.addEventListener("click", openJsonEditor);
      firstInput.style.cursor = "pointer"
    }
  }

  const changeField = () => {
    const { formid } = props
    ComponentManager.setStateForComponent(formid, "addSaveFunction", addSaveFunction);
    props.formInstance.setState({ addSaveFunction: addSaveFunction })
    const jsonSchema = ComponentManager.getStateForComponent(formid, "formData");
    const uiSchema = ComponentManager.getStateForComponent(formid, "uischema");
    if (jsonSchema) {
      if (uiSchema) {
        uiSchema['MENU_CONF'] = { "ui:readonly": true }
        delete jsonSchema.properties['MENU_CONF'].format
        ComponentManager.setStateForComponent(formid, "formData", jsonSchema);
        props.formInstance.setState({ formData: jsonSchema });
        ComponentManager.setStateForComponent(formid, "uischema", uiSchema);
        props.formInstance.setState({ uischema: uiSchema });
        setRender(true)
      }
    }
  }

  const reloadGrid = () => {
    GridManager.reloadGridData('SVAROG_MENU_GRID')
    ComponentManager.setStateForComponent('SVAROG_MENU_GRID', null, { rowClicked: undefined })
  }

  const addSaveFunction = () => {
    const { svSession } = props;
    const { formid } = props
    const formData = ComponentManager.getStateForComponent(formid, "formTableData");
    const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/SVAROG_MENU/0`
    const onConfirm = () => ComponentManager.setStateForComponent('SVAROG_MENU_FORM', null, { saveExecuted: false })
    axios({
      method: "post",
      data: encodeURIComponent(JSON.stringify(formData)),
      url,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then((res) => {
      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ type: resType, response: res, onConfirm })
        if (resType === 'success') {
          reloadGrid()
          setShow(false)
        }
      }
    }).catch(err => {
      console.error(err)
      alertUserResponse({ response: err, onConfirm })
    });
  };

  const openJsonEditor = () => {
    const { formid } = props
    const formData = ComponentManager.getStateForComponent(
      formid,
      "formTableData"
    );
    if (isJSON(formData['MENU_CONF'])) {
      setFieldJson(JSON.parse(formData['MENU_CONF']))
    }
    setShow(true)
  }

  const changeJson = (editedJson) => {
    const { formid } = props
    const formData = ComponentManager.getStateForComponent(formid, "formTableData");
    const onConfirm = () => {
      formData['MENU_CONF'] = JSON.stringify(editedJson)
      ComponentManager.setStateForComponent(formid, "formTableData", formData);
      props.formInstance.setState({ formTableData: formData });
    }
    alertUserV2({
      type: 'info',
      title: intl.formatMessage({ id: 'perun.admin_console.change_json', defaultMessage: 'perun.admin_console.change_json' }),
      onConfirm
    })
  }

  return (
    <>
      {shouldRender &&
        <>
          {props.children}
        </>
      }
      {show && (
        <Modal
          className='admin-console-unit-modal menu-editor-modal'
          show={show}
          onHide={() => { setShow(false) }}>
          <Modal.Header className='admin-console-unit-modal-header  menu-editor-header' closeButton>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body  menu-editor-body'>
            <JsonEditor value={fieldJson} onSave={changeJson} />
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer  menu-editor-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  );
};

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(SvarogMenuWrapper);
