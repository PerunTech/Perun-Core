import React, { useState } from "react";
import { useIntl } from 'react-intl';
import { connect } from "react-redux";
import { alertUserResponse, alertUserV2, ReactBootstrap } from "../../../elements";
const { Modal } = ReactBootstrap;
import axios from "axios";
import { GridManager } from "../../../client";
import OrgSearch from "./OrgSearch";
import { Loading } from '../../ComponentsIndex';

const OrgUserModal = (props) => {
  const intl = useIntl()
  const [loading, setLoading] = useState(false)
  const handleRowClick = (_id, _rowIdx, row) => {
    const title = intl.formatMessage({ id: 'perun.admin_console.add_user', defaultMessage: 'perun.admin_console.add_user' })
    const message = intl.formatMessage({ id: 'perun.admin_console.svarog_unit_add_user', defaultMessage: 'perun.admin_console.svarog_unit_add_user' })
    const confirm = intl.formatMessage({ id: 'perun.admin_console.add', defaultMessage: 'perun.admin_console.add' })
    const cancel = intl.formatMessage({ id: 'perun.admin_console.cancel', defaultMessage: 'perun.admin_console.cancel' })
    alertUserV2({
      type: 'question',
      title,
      message,
      confirmButtonText: confirm,
      confirmButtonColor: '#87adbd',
      onConfirm: () => assignUser(row),
      showCancel: true,
      cancelButtonText: cancel
    })
  };

  const assignUser = (row) => {
    setLoading(true)
    const objecidUser = row['SVAROG_USERS.OBJECT_ID']
    const url = window.server + `/WsAdminConsole/get/assignUserToOU/sid/${props.svSession}/objectIdOU/${props.objectIdOU}/objecidUser/${objecidUser}`
    axios.get(url).then((res) => {
      setLoading(false)
      if (res?.data) {
        const resType = res.data.type?.toLowerCase() || 'info'
        alertUserResponse({ response: res.data })
        if (resType === "success") {
          props.setAddUserFlag(false)
          GridManager.reloadGridData('ORG_USER_GRID')
        }
      }
    }).catch((err) => {
      console.error(err)
      setLoading(false)
      alertUserResponse({ response: err })
    });
  };

  return (
    <>
      {loading && <Loading />}
      <Modal
        className='admin-console-unit-modal'
        show={props.addUserFlag}
        onHide={() => props.setAddUserFlag(false)}
      >
        <Modal.Header className='admin-console-unit-modal-header' closeButton>
          <Modal.Title className='admin-console-unit-modal-body'>
            {intl.formatMessage({ id: 'perun.admin_console.choose_user', defaultMessage: 'perun.admin_console.choose_user' })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className='admin-console-unit-modal-body'>
          <OrgSearch handleRowClick={handleRowClick} />
        </Modal.Body>
        <Modal.Footer className='admin-console-unit-modal-footer'></Modal.Footer>
      </Modal>
    </>
  );
};

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(OrgUserModal);
