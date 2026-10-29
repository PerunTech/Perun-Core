import React, { useRef } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, GridManager, axios } from '../../../client'
import { alertUserResponse, alertUserV2, ReactBootstrap } from '../../../elements';
import { Loading } from '../../ComponentsIndex';
import PerunMenuWrapper from './PerunMenuWrapper';
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton'
const { useReducer, useEffect } = React;
const { Modal } = ReactBootstrap;

const PerunMenu = (props) => {
  const intl = useIntl()
  const initialState = { loading: false, tableName: 'PERUN_MENU', gridId: 'PERUN_MENU_GRID', show: false, objectId: 0 }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, tableName, gridId, show, objectId }, setState] = useReducer(reducer, initialState)

  const uploadInputRef = useRef(null)

  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId);
    }
  }, []);

  const reloadGrid = () => {
    GridManager.reloadGridData(gridId)
    ComponentManager.setStateForComponent(gridId, null, { rowClicked: undefined })
  }

  const handleRowClick = (_id, _rowIdx, row) => {
    setState({ objectId: row[`${tableName}.OBJECT_ID`] || 0, show: true })
  };

  const generatePerunMenuGrid = () => {
    const { svSession } = props;
    const buttonsArray = [
      {
        id: 'import_perun_menu',
        name: intl.formatMessage({ id: 'perun.admin_console.import_menu', defaultMessage: 'perun.admin_console.import_menu' }),
        action: () => uploadInputRef?.current?.click()
      },
      {
        id: 'add_perun_menu',
        name: intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' }),
        action: () => setState({ show: true, objectId: 0 })
      },
    ]

    return (
      <ExportableGrid
        gridType={'READ_URL'}
        key={gridId}
        id={gridId}
        configTableName={`/ReactElements/getTableFieldList/${svSession}/${tableName}`}
        dataTableName={`/ReactElements/getTableData/${props.svSession}/${tableName}/0`}
        onRowClickFunct={handleRowClick}
        refreshData={true}
        buttonsArray={buttonsArray}
        heightRatio={0.75}
        editContextFunc={handleRowClick}
      />
    )
  };

  const saveRecord = () => {
    const { svSession } = props
    const url = `${window.server}/Menu/add/${svSession}`
    const onConfirm = () => ComponentManager.setStateForComponent(`${tableName}_FORM`, null, { saveExecuted: false })
    const formData = ComponentManager.getStateForComponent(`${tableName}_FORM`, 'formTableData');
    const data = Object.assign({}, {
      ...formData,
      OBJECT_ID: objectId,
      MENU_CONF: formData.MENU_CONF ? JSON.parse(formData.MENU_CONF) : undefined
    })
    const reqConfig = { method: 'post', data, url, headers: { 'Content-Type': 'application/json' } }
    axios(reqConfig).then((res) => {
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
    });
  };

  const generatePerunMenuForm = (objectId) => {
    const { svSession } = props;
    return (
      <GenericForm
        params={'READ_URL'}
        key={`${tableName}_FORM`}
        id={`${tableName}_FORM`}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${tableName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${tableName}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${objectId}/${tableName}`}
        addSaveFunction={saveRecord}
        hideBtns={objectId === 0 ? 'closeAndDelete' : 'close'}
        addDeleteFunction={deleteFunc}
        className={'admin-settings-forms'}
        inputWrapper={PerunMenuWrapper}
        objectId={objectId}
      />
    )
  };

  const deleteFunc = (_id, _action, _session, formData) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(`${tableName}_FORM`, null, { deleteExecuted: false })
    const data = JSON.parse(formData[4]['PARAM_VALUE'])
    const menuCode = data.MENU_CODE
    const url = `${window.server}/Menu/remove/${svSession}/${menuCode}`
    axios.get(url).then(res => {
      if (res?.data) {
        const resType = res.data?.type?.toLowerCase() || 'info'
        alertUserResponse({ response: res, onConfirm })
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

  const uploadFile = (file) => {
    setState({ loading: true })
    const { svSession } = props
    const data = new FormData()
    data.append('file', file)
    const url = `${window.server}/Menu/upload/${svSession}`
    const reqConfig = { method: 'post', data, url, headers: { 'Content-Type': 'multipart/form-data' } }
    axios(reqConfig).then(res => {
      setState({ loading: false })
      if (res?.data) {
        alertUserResponse({ response: res })
        if (res.data?.type?.toLowerCase() === 'success') {
          reloadGrid()
        }
      }
    }).catch(err => {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    })
  }

  const handleFileSelection = (e) => {
    const notJSONLabel = intl.formatMessage({ id: 'perun.admin_console.file_is_not_json', defaultMessage: 'perun.admin_console.file_is_not_json' })
    const file = e.target.files[0]
    // Check if the selected file is valid JSON
    const fileReader = new FileReader()
    fileReader.onload = (e) => {
      try {
        JSON.parse(e.target.result)
        uploadFile(file)
      } catch (error) {
        console.error(error)
        alertUserV2({ type: 'info', title: notJSONLabel })
      }
    }
    fileReader.onerror = () => alertUserV2({ type: 'info', title: notJSONLabel })
    fileReader.readAsText(file)
    if (uploadInputRef?.current?.value) {
      uploadInputRef.current.value = ''
    }
  }

  return (
    <>
      {loading && <Loading />}
      <input type='file' id='upload-perun-menu-input' ref={uploadInputRef} onInput={handleFileSelection} style={{ display: 'none' }} />
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{intl.formatMessage({ id: 'perun.admin_console.perun_menu', defaultMessage: 'perun.admin_console.perun_menu' })}</p>
          <AdminConsoleHelpButton title={{ id: 'perun.admin_console.perun_menu', defaultMessage: 'perun.admin_console.perun_menu' }} />
        </div>
        {generatePerunMenuGrid()}
      </div>
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => setState({ show: false })}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
            <Modal.Title>{intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}</Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generatePerunMenuForm(objectId)}
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
        </Modal>
      )}
    </>
  );
};

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(PerunMenu);
