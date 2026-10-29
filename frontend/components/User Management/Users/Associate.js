import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import axios from 'axios'
import { ComponentManager, GenericGrid, GenericForm, GridManager } from '../../../client'
import { alertUserResponse, alertUserV2, ReactBootstrap } from '../../../elements'
import { Loading } from '../../ComponentsIndex'
import { getDynamicKey } from '../../../functions/utils'
const { useEffect } = React

const { Modal } = ReactBootstrap

const Associate = (props) => {
    const intl = useIntl()
    const [show, setShow] = useState(false)
    const [activeTab, setActiveTab] = useState(undefined);
    const [linkedTables, setLinkedTables] = useState([])
    const [searchResults, setSearchResults] = useState(undefined);
    const [loading, setLoading] = useState(false)
    // New on each opening: a fixed id could hand the search form the slice, and so the search handler, of the one before it
    const [searchFormId, setSearchFormId] = useState(undefined)
    useEffect(() => {
        getLinkedTables()
    }, [])

    const getLinkedTables = () => {
        setLoading(true)
        const url = window.server + `/ReactElements/getLinkedTableNamesByUserObjectType/${props.svSession}/${props.userType}`
        axios.get(url).then(res => {
            setLoading(false)
            if (res?.data && res?.data?.length > 0) {
                setLinkedTables(res?.data)
                setActiveTab(getTableName(res?.data[0]))
            }
        }).catch(err => {
            console.error(err)
            setLoading(false)
            alertUserResponse({ response: err })
        })
    }

    const getTableName = (table) => table?.table_name || table
    const getTableLabel = (table) => table?.label || getTableName(table)

    const setActiveFunc = (tab) => {
        setSearchResults(undefined);
        setActiveTab(tab);

    };

    const getTabClass = (tab) => (tab === activeTab ? 'user-tab-title active' : 'user-tab-title');

    const generateTabs = () => {
        if (!linkedTables?.length) return null;

        return linkedTables.map((table, index) => {
            const tableName = getTableName(table)
            const tableLabel = getTableLabel(table)

            return (
                <div
                    key={tableName || index}
                    onClick={() => setActiveFunc(tableName)}
                    className={getTabClass(tableName)}
                >
                    <p>
                        {tableLabel}
                    </p>
                </div>
            )
        });
    };

    const searchData = (table, formData) => {
        setLoading(true)
        setSearchResults(undefined);
        const url = window.server + `/ReactElements/getObjectsByCriteria/${props.svSession}/${table}`
        const reqConfig = {
            method: 'post',
            data: formData.formData,
            url,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
        axios(reqConfig).then(res => {
            setLoading(false)
            if (res?.data) {
                setSearchResults(res?.data?.data);
                ComponentManager.setStateForComponent(searchFormId, null, {
                    saveExecuted: false,
                });
            }
        }).catch(err => {
            console.error(err)
            alertUserResponse({ response: err })
            setLoading(false)
        })
    }

    const linkFunction = (row, shouldLink) => {
        const title = shouldLink ? `${intl.formatMessage({ id: 'perun.admin_console.link_user', defaultMessage: 'perun.admin_console.link_user' })}` : `${intl.formatMessage({ id: 'perun.admin_console.unlink_user', defaultMessage: 'perun.admin_console.unlink_user' })}`

        const confirmButtonText = shouldLink ? `${intl.formatMessage({ id: 'perun.admin_console.btn_link_user', defaultMessage: 'perun.admin_console.btn_link_user' })}` : `${intl.formatMessage({ id: 'perun.admin_console.btn_unlink_user', defaultMessage: 'perun.admin_console.btn_unlink_user' })}`

        const url = shouldLink ? `/ReactElements/linkObjects/${props.svSession}/${props.userId}/SVAROG_USERS/${row[`${activeTab}.OBJECT_ID`]}/${activeTab}/POA` : `/ReactElements/dropLink/${props.svSession}/${row[`${activeTab}.OBJECT_ID`]}/${activeTab}/${props.userId}/SVAROG_USERS/POA`
        alertUserV2({
            type: 'question',
            title: title,
            confirmButtonText: confirmButtonText,
            confirmButtonColor: '#87adbd',
            onConfirm: () => {
                setLoading(true)
                axios.get(window.server + url).then(res => {
                    setLoading(false)
                    if (res?.data) {
                        setShow(false);
                        setSearchResults(undefined);
                        ComponentManager.setStateForComponent(searchFormId, null, {
                            saveExecuted: false,
                        });
                        GridManager.reloadAllGrids()
                        alertUserResponse({ response: res })
                    }
                }).catch((error) => {
                    console.error(error)
                    setLoading(false)
                    alertUserResponse({ response: error })
                });
            },
            showCancel: true,
            cancelButtonText: `${intl.formatMessage({ id: 'perun.my_profile.cancel', defaultMessage: 'perun.my_profile.cancel' })}`
        })
    }

    return (
        <>
            {loading && <Loading />}
            <div className='user-mng-users'>
                <div className='user-mng-tabs'>
                    {generateTabs()}
                </div>
                <div className='user-mng-grid'>
                    {activeTab && linkedTables?.length > 0 &&
                        <GenericGrid
                            key={`${activeTab}_GRID`}
                            id={`${activeTab}_GRID`}
                            gridType={`READ_URL`}
                            configTableName={`/ReactElements/getTableFieldList/${props.svSession}/${activeTab}`}
                            dataTableName={`/ReactElements/getObjectByLink/${props.svSession}/${props.userId}/${activeTab}/POA/0`}
                            minHeight={500}
                            refreshData={true}
                            onRowClickFunct={(_id, _rowIdx, row) => linkFunction(row, false)}
                            customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.create_link', defaultMessage: 'perun.admin_console.create_link' })}
                            toggleCustomButton={true}
                            customButton={() => {
                                setSearchFormId(getDynamicKey())
                                setShow(true)
                            }}
                        />}

                </div>
            </div>
            {show && (
                <Modal className='admin-console-unit-modal' show={show} onHide={() => { setShow(false) }}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton>
                        <Modal.Title>{intl.formatMessage({ id: 'perun.main.grids.search', defaultMessage: 'perun.main.grids.search' })}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className='admin-console-unit-modal-body'>
                        <div className='user-mng-dashboard user-mng'>
                            <div className='user-dash-content'>
                                {activeTab && linkedTables?.length > 0 &&
                                    <GenericForm
                                        params="READ_URL"
                                        key={searchFormId}
                                        id={searchFormId}
                                        method={`/ReactElements/getTableSearchJSONSchema/${props.svSession}/${activeTab}`}
                                        uiSchemaConfigMethod={`/ReactElements/getTableUISchemaOverride/${props.svSession}/${activeTab}`}
                                        tableFormDataMethod={`/ReactElements/getTableFormData/${props.svSession}/0/${activeTab}`}
                                        addSaveFunction={(e) => searchData(activeTab, e)}
                                        hideBtns="closeAndDelete"
                                        customSaveButtonName={intl.formatMessage({ id: 'perun.main.grids.search', defaultMessage: 'perun.main.grids.search' })}
                                        customSave
                                    />
                                }
                                {searchResults && searchResults.length > 0 &&
                                    <GenericGrid
                                        key={`${activeTab}_ADD_GRID`}
                                        id={`${activeTab}_ADD_GRID`}
                                        gridType={`SEARCH_GRID_DATA`}
                                        configTableName={`/ReactElements/getTableFieldList/${props.svSession}/${activeTab}`}
                                        dataTableName={searchResults}
                                        minHeight={290}
                                        refreshData={true}
                                        onRowClickFunct={(_id, _rowIdx, row) => linkFunction(row, true)}
                                    />}

                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
                </Modal >
            )}
        </>
    )
}

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
})

export default connect(mapStateToProps)(Associate)
