import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { ComponentManager, ExportableGrid, GenericForm, GridManager, axios } from '../../../client'
import { alertUserResponse, alertUserV2, ReactBootstrap } from '../../../elements'
import OrgUserModal from './OrgUserModal'
import OrgMunicModal from './OrgMunicModal'
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton'
import { Loading } from '../../ComponentsIndex'
const { useEffect } = React
const { Modal } = ReactBootstrap

const OrganizationalUnit = (props) => {
  const intl = useIntl()
  const [show, setShow] = useState(false)
  const [row, setRow] = useState(undefined)
  const [active, setActive] = useState('EDIT')
  const [addMunicFlag, setAddMunicFlag] = useState(false)
  const [addUserFlag, setAddUserFlag] = useState(false)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    return () => {
      cleanUpGrids()
    }
  }, [])
  const cleanUpGrids = () => {
    ComponentManager.cleanComponentReducerState('SVAROG_ORG_GRID');
    ComponentManager.cleanComponentReducerState('ORG_MUNIC_GRID');
    ComponentManager.cleanComponentReducerState('ORG_USER_GRID');
  }
  const generateForm = (tableName, objectId) => {

    return (
      <GenericForm
        params="READ_URL"
        key={`${tableName}_FORM`}
        id={`${tableName}_FORM`}
        method={`/ReactElements/getTableJSONSchema/${props.svSession}/${tableName}`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${props.svSession}/${tableName}`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${props.svSession}/${objectId}/${tableName}`}
        hideBtns="all"
        className={'admin-settings-forms'}
        disabled={true}
      />
    );
  };
  const handleRowClick = (_id, _rowIdx, row) => {
    setShow(true)
    setRow(row)
    setActive('EDIT')
  }
  const getTabClass = (tab) => (tab === active ? 'user-control active' : 'user-control');
  const removeUserFromOrgUnit = (currentRow) => {
    alertUserV2({
      type: 'question',
      title: `${intl.formatMessage({ id: 'perun.admin_console.unassign_user', defaultMessage: 'perun.admin_console.unassign_user' })}`,
      confirmButtonText: `${intl.formatMessage({ id: 'perun.admin_console.unassign', defaultMessage: 'perun.admin_console.unassign' })}`,
      confirmButtonColor: '#87adbd',
      onConfirm: () => {
        setLoading(true)
        const { svSession } = props;
        let url = `${window.server}/WsAdminConsole/get/removeUserFromOU/sid/${svSession}/objectIdOU/${row['SVAROG_ORG_UNITS.OBJECT_ID']}/objecidUser/${currentRow['SVAROG_USERS.OBJECT_ID']}`;
        axios.get(url).then((res) => {
          setLoading(false)
          if (res?.data) {
            const resType = res.data?.type?.toLowerCase() || 'info'
            alertUserResponse({ response: res })
            if (resType === 'success') {
              GridManager.reloadGridData(`ORG_USER_GRID`);
            }
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
  };
  const removeMunicFromOrgUnit = (currentRow) => {
    alertUserV2({
      type: 'question',
      title: `${intl.formatMessage({ id: 'perun.admin_console.unassign_munic', defaultMessage: 'perun.admin_console.unassign_munic' })}`,
      confirmButtonText: `${intl.formatMessage({ id: 'perun.admin_console.unassign', defaultMessage: 'perun.admin_console.unassign' })}`,
      confirmButtonColor: '#87adbd',
      onConfirm: () => {
        setLoading(true)
        const { svSession } = props;
        let url = `${window.server}/WsAdminConsole/removeObjectFromOU/sid/${svSession}/objectIdOU/${row['SVAROG_ORG_UNITS.OBJECT_ID']}/objectId/${currentRow['NUTS_TERRITORIES.OBJECT_ID']}/tableName/NUTS_TERRITORIES`;
        axios({
          method: "post",
          url: url,
          data: {},
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then((res) => {
          setLoading(false)
          if (res?.data) {
            const resType = res.data.type?.toLowerCase() || 'info'
            alertUserResponse({ response: res })
            if (resType === 'success') {
              GridManager.reloadGridData(`ORG_MUNIC_GRID`);
            }
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
  };

  return (
    <>
      {loading && <Loading />}
      {/* INITIAL ORG UNIT CONTAINER */}
      <div className='admin-console-grid-container'>
        <div className='admin-console-component-header'>
          <p>{intl.formatMessage({ id: 'perun.admin_console.organizational_units', defaultMessage: 'perun.admin_console.organizational_units' })}</p>
          <AdminConsoleHelpButton title={{ id: 'perun.admin_console.organizational_units', defaultMessage: 'perun.admin_console.organizational_units' }} />
        </div>
        <ExportableGrid
          gridType='READ_URL'
          key={'SVAROG_ORG_GRID'}
          id={'SVAROG_ORG_GRID'}
          configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_ORG_UNITS`}
          dataTableName={`/ReactElements/getTableData/${props.svSession}/SVAROG_ORG_UNITS/100`}
          onRowClickFunct={handleRowClick}
          refreshData={true}
          toggleCustomButton={false}
          customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })}
          heightRatio={0.75}
        />
      </div>
      {/* MODAL AND CONTROLS */}
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => {
          setShow(false), setActive('EDIT'), ComponentManager.cleanComponentReducerState('ORG_MUNIC_GRID'),
            ComponentManager.cleanComponentReducerState('ORG_USER_GRID')
        }}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton>
          </Modal.Header>
          <Modal.Body className='admin-console-unit-modal-body'>
            <div className='user-mng-dashboard user-mng'>
              {/* USER DASH CONTROLS */}
              {<div className='user-dash-controls'>
                <div className={getTabClass('EDIT')} onClick={() => { setActive('EDIT') }}>{intl.formatMessage({ id: 'perun.admin_console.edit_org', defaultMessage: 'perun.admin_console.edit_org' })}</div>
                <div className={getTabClass('MUNIC')} onClick={() => { setActive('MUNIC') }}>{intl.formatMessage({ id: 'perun.admin_console.assign_munic', defaultMessage: 'perun.admin_console.assign_munic' })}</div>
                <div className={getTabClass('USER')} onClick={() => { setActive('USER') }}>{intl.formatMessage({ id: 'perun.admin_console.assign_user', defaultMessage: 'perun.admin_console.assign_user' })}</div>
              </div>}
              {/* RENDER ACTIVE*/}
              <div className='user-dash-content'>
                {active === 'EDIT' && generateForm('SVAROG_ORG_UNITS', row['SVAROG_ORG_UNITS.OBJECT_ID'])}
                {/* MUNICC */}
                {active === 'MUNIC' && <ExportableGrid
                  key={'ORG_MUNIC_GRID'}
                  id={'ORG_MUNIC_GRID'}
                  gridType={'READ_URL'}
                  configTableName={`/ReactElements/getTableFieldList/${props.svSession}/NUTS_TERRITORIES`}
                  dataTableName={`/WsAdminConsole/get/objectsByOU/sid/${props.svSession}/objectIdOU/${row['SVAROG_ORG_UNITS.OBJECT_ID']}/tableName/NUTS_TERRITORIES`}
                  minHeight={500}
                  refreshData={true}
                  toggleCustomButton={true}
                  customButton={() => {
                    setAddMunicFlag(true)
                  }}
                  customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.assign', defaultMessage: 'perun.admin_console.assign' })}
                  //  missing remove funcc
                  onRowClickFunct={(_id, _rowIdx, row) => removeMunicFromOrgUnit(row)}
                />}
                {/* HANDLE OLD USER WAY */}
                {active === 'USER' && <ExportableGrid
                  key={'ORG_USER_GRID'}
                  id={'ORG_USER_GRID'}
                  gridType={'READ_URL'}
                  configTableName={`/ReactElements/getTableFieldList/${props.svSession}/SVAROG_USERS`}
                  dataTableName={`/WsAdminConsole/get/usersByOU/sid/${props.svSession}/objectIdOU/${row['SVAROG_ORG_UNITS.OBJECT_ID']}`}
                  minHeight={500}
                  refreshData={true}
                  toggleCustomButton={true}
                  customButton={() => {
                    setAddUserFlag(true)
                  }}
                  customButtonLabel={intl.formatMessage({ id: 'perun.admin_console.assign', defaultMessage: 'perun.admin_console.assign' })}
                  //  missing remove funcc
                  onRowClickFunct={(_id, _rowIdx, row) => removeUserFromOrgUnit(row)}
                />}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
        </Modal>
      )}
      {addUserFlag && <OrgUserModal setAddUserFlag={setAddUserFlag} objectIdOU={row['SVAROG_ORG_UNITS.OBJECT_ID']} addUserFlag={addUserFlag} />}
      {addMunicFlag && <OrgMunicModal setAddMunicFlag={setAddMunicFlag} objectIdOU={row['SVAROG_ORG_UNITS.OBJECT_ID']} addMunicFlag={addMunicFlag} />}
    </>
  )

}
const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})
export default connect(mapStateToProps)(OrganizationalUnit)