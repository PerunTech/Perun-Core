import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm } from '../../../client'
import { ReactBootstrap } from '../../../elements'
import CreateAclCodes from '../../AdminConsole/CreateAclCodes'
import AssignAcl from '../../AdminConsole/AssignAcl'
const { useEffect } = React

const { Modal } = ReactBootstrap
// development note: refresh grids,add group menagement
// id cleanups
const Privileges = (props) => {
    const intl = useIntl()
    const [show, setShow] = useState(false)
    const [row, setRow] = useState(undefined)
    const [active, setActive] = useState('EDIT')
    const [assignFlag, setAssignFlag] = useState(false)
    useEffect(() => {
        return () => {
            ComponentManager.cleanComponentReducerState('SVAROG_ACL_GRID');
        }
    }, [])

    const handleRowClick = (_id, _rowIdx, row) => {
        setShow(true)
        setRow(row)
    }

    const generateForm = (tableName, objectId, search) => {
        let classNames = search ? 'admin-console-search-from hide-all-form-legends' : 'form-test'
        return <GenericForm
            params={'READ_URL'}
            key={`${tableName}_${objectId}_FORM`}
            id={`${tableName}_${objectId}_FORM`}
            method={`/ReactElements/getTableJSONSchema/${props.svSession}/${tableName}`}
            uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${props.svSession}/${tableName}`}
            tableFormDataMethod={`/ReactElements/getTableFormData/${props.svSession}/${objectId}/${tableName}`}
            addSaveFunction={(e) => console.log(e)}
            hideBtns={'all'}
            className={classNames}
            disabled
            helpSectionId={tableName}
        />
    }

    return (
        <>
            <div className='user-mng-users'>
                <div className='user-mng-grid'>
                    <ExportableGrid
                        gridType='READ_URL'
                        key={'SVAROG_ACL_GRID'}
                        id={'SVAROG_ACL_GRID'}
                        configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_ACL`}
                        dataTableName={`/ReactElements/getTableData/${props.svSession}/SVAROG_ACL/0`}
                        onRowClickFunct={handleRowClick}
                        refreshData={true}
                        buttonsArray={[
                            {
                                "name": intl.formatMessage({ id: 'perun.admin_console.assign_acl', defaultMessage: 'perun.admin_console.assign_acl' }),
                                "action": () => setAssignFlag(true),
                                "id": "second"
                            }, {
                                "name": intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' }),
                                "action": () => {
                                    setShow(true)
                                    setActive('ADD')
                                },
                                "id": "first"
                            }]
                        }
                        heightRatio={0.65}
                    />
                </div>
            </div>
            {show && (
                <Modal className='admin-console-unit-modal' show={show} onHide={() => { setShow(false), setActive('EDIT') }}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton>
                    </Modal.Header>
                    <Modal.Body className='admin-console-unit-modal-body'>
                        <div className='user-mng-dashboard user-mng'>
                            <div className='user-dash-content'>
                                {active === 'EDIT' && generateForm('SVAROG_ACL', row['SVAROG_ACL.OBJECT_ID'])}
                                {active === 'ADD' && <CreateAclCodes />}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
                </Modal >
            )}
            {assignFlag && <AssignAcl setAssignFlag={setAssignFlag} />}
        </>
    )
}

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
})

export default connect(mapStateToProps)(Privileges)
