
import React from 'react'
import { useIntl } from 'react-intl'
import { ComponentManager, ExportableGrid, GenericForm, GridManager, axios } from '../../client'
import { connect } from 'react-redux'
const { useState, useEffect } = React;
import { alertUserResponse, ReactBootstrap } from "../../elements";
import ConfigMenuWrapper from './ConfigMenuWrapper';
import AdminConsoleHelpButton from './Help/AdminConsoleHelpButton';
const { Modal } = ReactBootstrap;

const tableName = "SVAROG_PERUN_PLUGIN";
const gridId = `${tableName}_GRID`;

const PerunPluginTable = (props) => {
    const intl = useIntl()
    const [show, setShow] = useState(false);
    const [objectId, setObjectId] = useState(undefined)

    useEffect(() => {
        return () => {
            ComponentManager.cleanComponentReducerState(gridId);
        }
    }, []);
    //edit on row click
    const handleRowClick = (_id, _rowIdx, row) => {
        setObjectId(row[`${'SVAROG_PERUN_PLUGIN'}.OBJECT_ID`] || 0)
        setShow(true)
    };
    //togglemodal
    const generatePluginTable = () => {
        const { svSession } = props;
        return (
            <ExportableGrid
                gridType={"READ_URL"}
                key={gridId}
                id={gridId}
                configTableName={`/ReactElements/getTableFieldList/${svSession}/${tableName}`}
                dataTableName={
                    `/ReactElements/getTableData/${props.svSession}/${tableName}/0`}
                onRowClickFunct={handleRowClick}
                refreshData={true}
                toggleCustomButton={true}
                customButton={() => {
                    setShow(true)
                    setObjectId(0)
                }}
                customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}
                heightRatio={0.75}
                editContextFunc={handleRowClick}
            />
        );
    };
    //create record
    const saveRecord = (e) => {
        const { svSession } = props;
        const onConfirm = () => ComponentManager.setStateForComponent(`${tableName}_FORM`, null, { saveExecuted: false })
        const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/${tableName}/0`
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
                    GridManager.reloadGridData(gridId)
                    ComponentManager.setStateForComponent(gridId, null, { rowClicked: undefined })
                    setShow(false);
                }
            }
        }).catch(err => {
            console.error(err)
            alertUserResponse({ response: err, onConfirm })
        });
    };
    //create record form
    const generatePluginForm = (objectId) => {
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
                inputWrapper={ConfigMenuWrapper}
            />
        )
    };

    const deleteFunc = (_id, _action, _session, formData) => {
        const { svSession } = props;
        const onConfirm = () => ComponentManager.setStateForComponent(`${tableName}_FORM`, null, { deleteExecuted: false })
        const url = `${window.server}/ReactElements/deleteObject/${svSession}`
        axios({
            method: "post",
            data: encodeURIComponent(formData[4]["PARAM_VALUE"]),
            url: url,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then((res) => {
            if (res?.data) {
                const resType = res.data?.type?.toLowerCase() || 'info'
                alertUserResponse({ type: resType, response: res, onConfirm })
                if (resType === 'success') {
                    GridManager.reloadGridData(gridId)
                    ComponentManager.setStateForComponent(gridId, null, { rowClicked: undefined })
                    setShow(false);
                }
            }
        }).catch(err => {
            console.error(err)
            alertUserResponse({ response: err, onConfirm })
        });
    };

    return (
        <>
            <div className='admin-console-grid-container'>
                <div className='admin-console-component-header'>
                    <p>{intl.formatMessage({ id: 'perun.admin_console.perun_plugin_table_editor', defaultMessage: 'perun.admin_console.perun_plugin_table_editor' })}</p>
                    <AdminConsoleHelpButton title={{ id: 'perun.admin_console.perun_plugin_table_editor', defaultMessage: 'perun.admin_console.perun_plugin_table_editor' }} />
                </div>
                {generatePluginTable()}
            </div>
            {show && (
                <Modal className='admin-console-unit-modal' show={show} onHide={() => setShow(false)}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton>
                        <Modal.Title>{intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className='admin-console-unit-modal-body'>
                        {generatePluginForm(objectId)}
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

export default connect(mapStateToProps)(PerunPluginTable);
