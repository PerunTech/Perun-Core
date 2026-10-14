import React, { useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GridManager, axios } from '../../../client'
import { alertUserResponse, ReactBootstrap } from '../../../elements'
const { useEffect } = React
const { Modal } = ReactBootstrap
import { Loading } from '../../ComponentsIndex'
const OrgMunicModal = (props) => {
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        return () => {
            ComponentManager.cleanComponentReducerState('ADD_MUNIC_GRID');
        }
    }, [])

    const handleRowClick = (_id, _rowIdx, row) => {
        setLoading(true)
        let url = `${window.server}/WsAdminConsole/assignToOU/sid/${props.svSession}/objectIdOU/${props.objectIdOU}/objectId/${row['NUTS_TERRITORIES.OBJECT_ID']}/tableName/NUTS_TERRITORIES`
        axios({
            method: "post",
            url: url,
            data: {},
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then((res) => {
            setLoading(false)
            if (res?.data) {
                GridManager.reloadGridData('ORG_MUNIC_GRID')
                alertUserResponse({ response: res })
                props.setAddMunicFlag(false)
            }
        }).catch(err => {
            alertUserResponse({ response: err, type: 'error' })
            setLoading(false)
        })
    }

    return (
        <>
            {loading && <Loading />}
            {props.addMunicFlag && (
                <Modal className='admin-console-unit-modal' show={props.addMunicFlag} onHide={() => { props.setAddMunicFlag(false) }}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton>
                    </Modal.Header>
                    <Modal.Body className='admin-console-unit-modal-body'>
                        <div className='user-mng-dashboard user-mng'>
                            <div className='user-dash-content'>
                                <ExportableGrid
                                    key={'ADD_MUNIC_GRID'}
                                    id={'ADD_MUNIC_GRID'}
                                    gridType={'READ_URL'}
                                    configTableName={`/ReactElements/getTableFieldList/${props.svSession}/NUTS_TERRITORIES`}
                                    dataTableName={`/ReactElements/getTableData/${props.svSession}/NUTS_TERRITORIES/0`}
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

export default connect(mapStateToProps)(OrgMunicModal)
