import React from 'react'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GridManager, Loading, axios } from '../../../client'
import { alertUserResponse, ReactBootstrap } from '../../../elements'
const { useEffect, useState } = React
const { Modal } = ReactBootstrap

const UsersAddGroup = (props) => {
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        return () => {
            ComponentManager.cleanComponentReducerState('USER_ADD_GROUP_GRID');
        }
    }, [])

    const handleRowClick = (_id, _rowIdx, row) => {
        let url = `${window.server}/WsAdminConsole/updateUserGroup/${props.svSession}/${props.userId}/${row['SVAROG_USER_GROUPS.OBJECT_ID']}/add`
        setLoading(true)
        axios.get(url).then(res => {
            GridManager.reloadAllGrids()
            alertUserResponse({ response: res })
            setLoading(false)
            props.setAddGroupFlag(false)
        }).catch(err => {
            setLoading(false)
            alertUserResponse({ response: err, type: 'error' })
        })

    }

    return (
        <>
            {props.addGroupFlag && (
                <Modal className='admin-console-unit-modal' show={props.addGroupFlag} onHide={() => { props.setAddGroupFlag(false) }}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton>
                    </Modal.Header>
                    <Modal.Body className='admin-console-unit-modal-body'>
                        {loading && <Loading />}
                        <div className='user-mng-dashboard user-mng'>
                            <div className='user-dash-content'>
                                <ExportableGrid
                                    key={'USER_ADD_GROUP_GRID'}
                                    id={'USER_ADD_GROUP_GRID'}
                                    gridType={'READ_URL'}
                                    configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_USER_GROUPS`}
                                    dataTableName={`/ReactElements/getTableData/${props.svSession}/SVAROG_USER_GROUPS/0`}
                                    minHeight={600}
                                    refreshData={true}
                                    onRowClickFunct={handleRowClick}
                                />
                            </div>
                        </div>
                    </Modal.Body>
                </Modal>
            )}
        </>
    )
}

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
})

export default connect(mapStateToProps)(UsersAddGroup)
