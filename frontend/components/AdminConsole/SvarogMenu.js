import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, GridManager, axios } from '../../client'
import { alertUserResponse, ReactBootstrap } from '../../elements';
import SvarogMenuWrapper from './SvarogMenuWrapper';
const { useReducer, useEffect } = React;
const { Modal } = ReactBootstrap;

const SvarogMenu = (props) => {
  const intl = useIntl()
  const initialState = { tableName: 'SVAROG_MENU', gridId: 'SVAROG_MENU_GRID', show: false, objectId: 0 }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ tableName, gridId, show, objectId }, setState] = useReducer(reducer, initialState)

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

  const generateSvarogMenuGrid = () => {
    const { svSession } = props;
    return (
      <ExportableGrid
        gridType={"READ_URL"}
        key={gridId}
        id={gridId}
        configTableName={`/ReactElements/getTableFieldList/${svSession}/${tableName}`}
        dataTableName={`/ReactElements/getTableData/${props.svSession}/${tableName}/0`}
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
  };

  const saveRecord = (e) => {
    const { svSession } = props;
    const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/${tableName}/0`
    const onConfirm = () => ComponentManager.setStateForComponent(`${tableName}_FORM`, null, { saveExecuted: false })
    axios({
      method: "post",
      data: encodeURIComponent(JSON.stringify(e.formData)),
      url,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    });
  };

  const generateSvarogMenuForm = (objectId) => {
    const { svSession } = props;
    return (
      <GenericForm
        params={"READ_URL"}
        key={`${tableName}_FORM`}
        id={`${tableName}_FORM`}
        method={`/ReactElements/getTableJSONSchema/${svSession}/${tableName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/${tableName}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${objectId}/${tableName}`}
        addSaveFunction={(e) => saveRecord(e)}
        hideBtns={objectId === 0 ? 'closeAndDelete' : 'close'}
        addDeleteFunction={deleteFunc}
        className={'admin-settings-forms'}
        inputWrapper={SvarogMenuWrapper}
      />
    )
  };

  const deleteFunc = (_id, _action, _session, formData) => {
    const { svSession } = props
    const onConfirm = () => ComponentManager.setStateForComponent(`${tableName}_FORM`, null, { deleteExecuted: false })
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
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{intl.formatMessage({ id: 'perun.admin_console.svarog_menus_editor', defaultMessage: 'perun.admin_console.svarog_menus_editor' })}</p>
        </div>
        {generateSvarogMenuGrid()}
      </div>
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => setState({ show: false })}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
            <Modal.Title>{intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}</Modal.Title>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            {generateSvarogMenuForm(objectId)}
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

export default connect(mapStateToProps)(SvarogMenu);
