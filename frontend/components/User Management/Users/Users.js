import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericGrid, GenericForm, GridManager, Loading, axios } from '../../../client'
import { alertUserV2, ReactBootstrap } from '../../../elements'
const { useEffect } = React
const { Modal } = ReactBootstrap
import ReactDOM from 'react-dom'
import { alertUserResponse } from '../../../elements'
import UsersAddGroup from './UsersAddGroup'
import AddUserWrapper from './AddUserWrapper'
import EditUserWrapper from './EditUserWrapper'
import Associate from './Associate'
import Swal from 'sweetalert2'
const Users = (props, context) => {
    const [loading, setLoading] = useState(false)
    const [show, setShow] = useState(false)
    const [row, setRow] = useState(undefined)
    const [active, setActive] = useState('EDIT')
    const [hideControls, setHideControls] = useState(false)
    const [addGroupFlag, setAddGroupFlag] = useState(false)
    const [usersData, setUsersData] = useState(undefined)
    useEffect(() => {
        refreshGrid()
    }, [])

    const refreshGrid = () => {
        setUsersData(false)
        ComponentManager.cleanComponentReducerState('USERS_MAIN_GRID');
        setLoading(true)
        axios.get(`${window.server}/ReactElements/getTableData/${props.svSession}/SVAROG_USERS/0/PKID`).then(res => {
            setLoading(false)
            setUsersData(res?.data)
        }).catch(err => { alertUserResponse({ response: err }), setLoading(false) });
    }

    const generateForm = (tableName, objectId, formType, formId) => {
        let inputWrapper = null;
        let classNames = '';
        let label = '';
        let method = '';

        switch (formType) {
            case 'search':
                classNames = 'admin-console-search-from hide-all-form-legends';
                label = context.intl.formatMessage({ id: 'perun.generalLabel.search', defaultMessage: 'perun.generalLabel.search' });
                method = `/WsAdminConsole/getSvarogUsersSearchJSONSchema/${props.svSession}/${tableName}`;
                break;
            case 'add':
                inputWrapper = AddUserWrapper;
                classNames = 'form-test admin-settings-forms add-user-wrapper';
                label = context.intl.formatMessage({ id: 'perun.admin_console.save', defaultMessage: 'perun.admin_console.save' });
                method = `/ReactElements/getTableJSONSchema/${props.svSession}/${tableName}`;
                break;
            case 'edit':
                inputWrapper = EditUserWrapper;
                classNames = 'form-test admin-settings-forms edit-user-wrapper';
                label = context.intl.formatMessage({ id: 'perun.admin_console.save', defaultMessage: 'perun.admin_console.save' });
                method = `/ReactElements/getTableJSONSchema/${props.svSession}/${tableName}`;
                break;
            default:
                return null;
        }

        const saveFunction = formType === 'search' ? searchData : handleSave;

        return (
            <GenericForm
                params="READ_URL"
                key={formId}
                id={formId}
                method={method}
                uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${props.svSession}/${tableName}`}
                tableFormDataMethod={`/ReactElements/getTableFormData/${props.svSession}/${objectId}/${tableName}`}
                addSaveFunction={(e) => saveFunction(e, formId)}
                hideBtns="closeAndDelete"
                className={classNames}
                inputWrapper={inputWrapper}
                afterSaveCleanUp={() => { refreshGrid(); setShow(false); }}
                customSaveButtonName={label}
                customSave
                helpSectionId={formType !== 'search' ? tableName : undefined}
                disableHelpButtons={formType === 'search'}
            />
        );
    };

    const searchData = (e, formId) => {
        setLoading(true)
        const url = `${window.server}/WsAdminConsole/searchUsers/${props.svSession}`
        axios({
            method: "post",
            data: encodeURIComponent(JSON.stringify(e.formData)),
            url: url,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then(res => {
            setLoading(false)
            setUsersData(undefined)
            setUsersData(res?.data || [])
            ComponentManager.setStateForComponent(formId, null, {
                saveExecuted: false,
            });
        }).catch(err => {
            console.error(err)
            setLoading(false)
            alertUserResponse({ response: err, type: 'error' })
        })
    }
    const handleSave = (e, formId) => {
        let url = `${window.server}/WsAdminConsole/editUser/${props.svSession}/${row['SVAROG_USERS.OBJECT_ID']}`
        axios({
            method: "post",
            data: encodeURIComponent(JSON.stringify(e.formData)),
            url,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then((res) => {
            alertUserResponse({ response: res })
            refreshGrid()
            ComponentManager.setStateForComponent(formId, null, {
                saveExecuted: false,
            });
        }).catch(err => {
            alertUserResponse({ response: err, type: 'error' })
            refreshGrid()
            ComponentManager.setStateForComponent(formId, null, {
                saveExecuted: false,
            });
        });
    };
    const handleRowClick = (_id, _rowIdx, row) => {
        setShow(true)
        setRow(row)
        setActive('EDIT')
        setHideControls(false)
    }
    const getTabClass = (tab) => (tab === active ? 'user-control active' : 'user-control');
    const changeUserStatus = () => {
        const initialStatus = row['SVAROG_USERS.STATUS']
        const objectId = row['SVAROG_USERS.OBJECT_ID']
        const status = initialStatus === "VALID" ? 'INVALID' : 'VALID'
        const label = context.intl.formatMessage({ id: `perun.admin_console.user_change_status_${status.toLocaleLowerCase()}`, defaultMessage: `perun.admin_console.user_change_status_${status.toLocaleLowerCase()}` })
        const question = context.intl.formatMessage({ id: 'perun.admin_console.user_change_status', defaultMessage: 'perun.admin_console.user_change_status' })
        const yesLabel = context.intl.formatMessage({ id: 'perun.admin_console.yes', defaultMessage: 'perun.admin_console.yes' })
        const noLabel = context.intl.formatMessage({ id: 'perun.admin_console.no', defaultMessage: 'perun.admin_console.no' })
        const onConfirm = () => {
            const url = `${window.server}/WsAdminConsole/changeUserStatus/${props.svSession}/${objectId}/${status}`
            axios.get(url).then(res => {
                alertUserResponse({ response: res })
                refreshGrid()
            }).catch(err => alertUserResponse({ response: err, type: 'error' }));
        }
        const alertParams = {
            type: 'question',
            title: question,
            message: label,
            confirmButtonText: yesLabel,
            confirmButtonColor: '#87adbd',
            onConfirm,
            showCancel: true,
            cancelButtonText: noLabel
        }
        alertUserV2(alertParams)
    }
    const generateGroupContorls = (_id, _rowIdx, row, default_g) => {
        const customElement = document.createElement('div')
        ReactDOM.render(<div className='add-edit-users-form group-controls'>
            <button className='btn-success btn_save_form' onClick={() => removeGroup(row)}>{context.intl.formatMessage({ id: 'perun.admin_console.remove', defaultMessage: 'perun.admin_console.remove' })}</button>
            {!default_g && <button className='btn-success btn_save_form' onClick={() => setBasicGroup(row)}>{context.intl.formatMessage({ id: 'perun.admin_console.basic_group', defaultMessage: 'perun.admin_console.basic_group' })}</button>}
            <button className='cancel-btn' onClick={() => Swal.close()}>{context.intl.formatMessage({ id: 'perun.my_profile.cancel', defaultMessage: 'perun.my_profile.cancel' })}</button>
        </div>, customElement)
        return customElement
    }
    const setBasicGroup = (gridRow) => {
        const url = `${window.server}/WsAdminConsole/addDefaultUserGroup/${props.svSession}/${row['SVAROG_USERS.OBJECT_ID']}/${gridRow['SVAROG_USER_GROUPS.OBJECT_ID']}/true`
        axios.get(url).then(res => {
            alertUserResponse({ response: res })
            GridManager.reloadAllGrids()
        }).catch(err => alertUserResponse({ response: err, type: 'error' }));
    }
    const removeGroup = (gridRow) => {
        const url = `${window.server}/WsAdminConsole/updateUserGroup/${props.svSession}/${row['SVAROG_USERS.OBJECT_ID']}/${gridRow['SVAROG_USER_GROUPS.OBJECT_ID']}/remove`
        axios.get(url).then(res => {
            alertUserResponse({ response: res })
            GridManager.reloadAllGrids()
        }).catch(err => alertUserResponse({ response: err, type: 'error' }));
    }
    return (
        <>
            {loading && <Loading />}
            <div className='user-mng-users'>
                <div className='user-mng-search'>
                    {generateForm('SVAROG_USERS', 0, 'search', 'USERS_SEARCH_FORM')}
                </div>
                {usersData && <div className='user-mng-grid'>
                    <ExportableGrid
                        gridType='SEARCH_GRID_DATA'
                        key={'USERS_MAIN_GRID'}
                        id={'USERS_MAIN_GRID'}
                        configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_USERS`}
                        dataTableName={usersData}
                        onRowClickFunct={handleRowClick}
                        refreshData={true}
                        toggleCustomButton={true}
                        customButton={() => {
                            setShow(true)
                            setHideControls(true)
                            setActive('ADD')
                        }}
                        customButtonLabel={context.intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}
                        heightRatio={0.55}
                        editContextFunc={handleRowClick}
                    />
                </div>}
            </div>
            {show && (
                <Modal className='admin-console-unit-modal' show={show} onHide={() => {
                    setShow(false), setActive('EDIT'), ComponentManager.cleanComponentReducerState('USER_GROUP_GRID'),
                        ComponentManager.cleanComponentReducerState('USERS_ACL_GRID')
                }}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton>
                    </Modal.Header>
                    <Modal.Body className='admin-console-unit-modal-body'>
                        <div className='user-mng-dashboard user-mng'>
                            {/* USER DASH CONTROLS */}
                            {!hideControls && <div className='user-dash-controls'>
                                <div className={getTabClass('EDIT')} onClick={() => { setActive('EDIT') }}>{context.intl.formatMessage({ id: 'perun.user_mng.edit_user', defaultMessage: 'perun.user_mng.edit_user' })}</div>
                                <div className={'user-control'} onClick={() => changeUserStatus()}>{context.intl.formatMessage({ id: 'perun.user_mng.chg_status', defaultMessage: 'perun.user_mng.chg_status' })}</div>
                                <div className={getTabClass('GROUP')} onClick={() => { setActive('GROUP') }}>{context.intl.formatMessage({ id: 'perun.user_mng.chg_user_group', defaultMessage: 'perun.user_mng.chg_user_group' })}</div>
                                <div className={getTabClass('PRIVILEGES')} onClick={() => { setActive('PRIVILEGES') }}>{context.intl.formatMessage({ id: 'perun.user_mng.show_privileges', defaultMessage: 'perun.user_mng.show_privileges' })}</div>
                                <div className={getTabClass('ASSOCIATE')} onClick={() => { setActive('ASSOCIATE') }}>{context.intl.formatMessage({ id: 'perun.user_mng.associate_user', defaultMessage: 'perun.user_mng.associate_user' })}</div>
                            </div>}
                            {/* RENDER ACTIVE*/}
                            <div className='user-dash-content'>
                                {/* ADD USER */}
                                {active === 'ADD' && generateForm('SVAROG_USERS', 0, 'add', 'USERS_ADD_FORM')}
                                {active === 'EDIT' && generateForm('SVAROG_USERS', row['SVAROG_USERS.OBJECT_ID'], 'edit', 'USERS_EDIT_FORM')}
                                {active === 'GROUP' && <div className='admin-console-user-groups'>
                                    <div className='user-mng-header'>
                                        <p>{context.intl.formatMessage({ id: 'perun.admin_console.default_group', defaultMessage: 'perun.admin_console.default_group' })}</p>
                                    </div>
                                    <GenericGrid
                                        key={'USER_GROUP_DEFAULT_GRID'}
                                        id={'USER_GROUP_DEFAULT_GRID'}
                                        gridType={'READ_URL'}
                                        configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_USER_GROUPS`}
                                        dataTableName={`/WsAdminConsole/getLinkedGroups/${props.svSession}/${row['SVAROG_USERS.OBJECT_ID']}/Y`}
                                        minHeight={100}
                                        refreshData={true}
                                        onRowClickFunct={(_id, _rowIdx, row) => alertUserV2({
                                            html: generateGroupContorls(_id, _rowIdx, row, true),
                                            allowOutsideClick: true,
                                            showConfirm: false,
                                        })}
                                    />
                                    <div className='user-mng-header'>
                                        <p>{context.intl.formatMessage({ id: 'perun.admin_console.all_groups', defaultMessage: 'perun.admin_console.all_groups' })}</p>
                                    </div>
                                    <ExportableGrid
                                        key={'USER_GROUP_GRID'}
                                        id={'USER_GROUP_GRID'}
                                        gridType={'READ_URL'}
                                        configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_USER_GROUPS`}
                                        dataTableName={`/WsAdminConsole/getLinkedGroups/${props.svSession}/${row['SVAROG_USERS.OBJECT_ID']}/N`}
                                        minHeight={350}
                                        refreshData={true}
                                        toggleCustomButton={true}
                                        customButton={() => {
                                            setAddGroupFlag(true)
                                        }}
                                        customButtonLabel={context.intl.formatMessage({ id: 'perun.admin_console.add_group', defaultMessage: 'perun.admin_console.add_group' })}
                                        onRowClickFunct={(_id, _rowIdx, row) => alertUserV2({
                                            html: generateGroupContorls(_id, _rowIdx, row),
                                            allowOutsideClick: true,
                                            showConfirm: false,
                                        })}
                                    />
                                </div>}
                                {active === 'PRIVILEGES' && <ExportableGrid
                                    key={'USERS_ACL_GRID'}
                                    id={'USERS_ACL_GRID'}
                                    gridType={'READ_URL'}
                                    configTableName={`/WsAdminConsole/get-acl-by-user-field-list/sid/${props.svSession}`}
                                    dataTableName={`/WsAdminConsole/get-acl-by-user/sid/${props.svSession}/user_object_id/${row['SVAROG_USERS.OBJECT_ID']}`}
                                    minHeight={500}
                                    refreshData={true}
                                />}
                                {active === 'ASSOCIATE' && <Associate userId={row['SVAROG_USERS.OBJECT_ID']} userType={row['SVAROG_USERS.OBJECT_TYPE']} />}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
                </Modal>
            )}
            {addGroupFlag && <UsersAddGroup addGroupFlag={addGroupFlag} setAddGroupFlag={setAddGroupFlag} userId={row['SVAROG_USERS.OBJECT_ID']} />}
        </>
    )

}
const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
})
Users.contextTypes = {
    intl: PropTypes.object.isRequired
}
export default connect(mapStateToProps)(Users)
