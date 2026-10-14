import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import axios from 'axios';
import { alertUserResponse, alertUserV2, ReactBootstrap } from '../../elements';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

const { Modal } = ReactBootstrap;

const AssignAcl = (props) => {
  const intl = useIntl();
  const [formData, setFormData] = useState({ actionType: '', aclList: '', groupType: '' });
  const [allGroups, setAllGroups] = useState([]);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (props.groupType) {
      setFormData(prev => ({ ...prev, groupType: props.groupType.toString() }));
      setAllGroups([{ groupName: props.groupName, objectId: props.groupType.toString() }]);
    } else {
      getAllGroups();
    }
  }, []);

  const getAllGroups = async () => {
    const url = `${window.server}/WsAdminConsole/getAllGroups/${props.svSession}`;
    try {
      const response = await axios.get(url);
      if (response?.data?.data) {
        setAllGroups(response.data.data);
      }
    } catch (error) {
      console.error(error);
      alertUserResponse({ response: error })
    }
  };

  const schema = {
    title: intl.formatMessage({ id: 'perun.admin_console.assign_permission', defaultMessage: 'Assign ACL Permission' }),
    type: 'object',
    required: ['actionType', 'aclList', 'groupType'],
    properties: {
      actionType: {
        type: 'string',
        title: intl.formatMessage({ id: 'perun.admin_console.manage_permission', defaultMessage: 'Manage Permission' }),
        enum: ['REVOKE', 'GRANT'],
      },
      groupType: {
        type: 'string',
        title: intl.formatMessage({ id: 'perun.admin_console.group_name', defaultMessage: 'Group Name' }),
        enum: allGroups.map(group => group.objectId),
        enumNames: allGroups.map(group => group.groupName),
      },
      aclList: {
        type: 'string',
        title: intl.formatMessage({ id: 'perun.admin_console.code_control_guide', defaultMessage: 'ACL Codes' }),
      },
    },
  };

  const uiSchema = {
    aclList: {
      'ui:widget': 'textarea',
      'ui:options': {
        rows: 4,
      },
    },
  };

  const handleSubmit = async ({ formData }) => {
    const { actionType, aclList, groupType } = formData;

    if (!actionType || !aclList || !groupType) {
      alertUserV2({
        type: 'info',
        title: intl.formatMessage({ id: 'perun.admin_console.fill_inputs', defaultMessage: 'perun.admin_console.fill_inputs' })
      })
      return;
    }

    const postUrl = `${window.server}/WsAdminConsole/manageCustomAcl/${props.svSession}`;
    const params = { manage: actionType, aclCode: aclList, groupObjId: groupType };

    try {
      const response = await axios.post(postUrl, JSON.stringify(params), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response?.data) {
        const { type } = response.data;
        const resType = type?.toLowerCase() || 'info'
        alertUserResponse({ response: response.data });
        if (resType === 'success') {
          setFormData({ actionType: '', aclList: '', groupType: '' });
          props.setAssignFlag(false)
        }
      }
    } catch (err) {
      console.error(err)
      alertUserResponse({ response: err })
    }
  };

  return (
    <>
      {show && (
        <Modal className='admin-console-unit-modal' show={show} onHide={() => { setShow(false); props.setAssignFlag(false); }}>
          <Modal.Header className='admin-console-unit-modal-header' closeButton />
          <Modal.Body className='admin-console-unit-modal-body'>
            <div className='user-mng-dashboard user-mng'>
              <div className='user-dash-content'>
                <Form
                  validator={validator}
                  schema={schema}
                  uiSchema={uiSchema}
                  formData={formData}
                  onChange={(e) => setFormData(e.formData)}
                  onSubmit={handleSubmit}
                  className='create-acl-form'
                />
              </div>
            </div>
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

AssignAcl.propTypes = {
  svSession: PropTypes.string.isRequired,
};

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(AssignAcl);
