import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import axios from 'axios';
import { connect } from 'react-redux';
import { alertUserResponse, alertUserV2, GridManager } from '../../elements';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

const CreateAclCodes = ({ svSession }) => {
  const intl = useIntl();
  const [formData, setFormData] = useState({ aclCode: '', accessType: '' });

  const schema = {
    title: intl.formatMessage({ id: 'perun.admin_console.create_permission', defaultMessage: 'perun.admin_console.create_permission' }),
    type: 'object',
    required: ['aclCode', 'accessType'],
    properties: {
      accessType: {
        type: 'string',
        title: intl.formatMessage({ id: 'perun.admin_console.permission_type', defaultMessage: 'perun.admin_console.permission_type' }),
        enum: ['READ', 'MODIFY', 'NONE', 'WRITE', 'EXECUTE', 'FULL'],
      },
      aclCode: {
        type: 'string',
        title: intl.formatMessage({ id: 'perun.admin_console.code_control_guide', defaultMessage: 'perun.admin_console.code_control_guide' }),
        default: '',
      },
    },
  };

  const uiSchema = {
    aclCode: {
      'ui:widget': 'textarea',
      'ui:options': {
        rows: 4,
      },
    },
    accessType: {
      'ui:placeholder': intl.formatMessage({ id: 'perun.admin_console.choose_value', defaultMessage: 'perun.admin_console.choose_value' }),
    },
  };

  const handleSubmit = async ({ formData }) => {
    const { aclCode, accessType } = formData;

    if (!aclCode || !accessType) {
      alertUserV2({
        type: 'info',
        title: intl.formatMessage({ id: 'perun.admin_console.fill_inputs', defaultMessage: 'perun.admin_console.fill_inputs' })
      })
      return;
    }

    const restUrl = `${window.server}/WsAdminConsole/createCustomAcl/${svSession}`;
    const params = { aclCode, accessType };

    try {
      const response = await axios.post(restUrl, JSON.stringify(params), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response?.data) {
        const { type } = response.data;
        const resType = type?.toLowerCase() || 'info'
        alertUserResponse({ response: response.data });
        if (resType === 'success') {
          setFormData({ aclCode: '', accessType: '' });
          GridManager.reloadGridData('SVAROG_ACL');
        }
      }
    } catch (err) {
      console.error(err)
      alertUserResponse({ response: err })
    }
  };

  return (
    <div className="admin-console-acl-create">
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
  );
};

CreateAclCodes.propTypes = {
  svSession: PropTypes.string.isRequired,
};

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(CreateAclCodes);
