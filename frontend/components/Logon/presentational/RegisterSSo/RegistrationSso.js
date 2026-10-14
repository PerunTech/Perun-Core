import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import axios from 'axios';
import { alertUserResponse, alertUserV2 } from './../../../../elements';
import getRegisterSsoForm from './RegisterSsoForm';

const RegistrationSso = () => {
    const intl = useIntl()
    const [data, setData] = useState({})
    const [key, setKey] = useState('')

    useEffect(() => {
        if (window.userObject) {
            axios.get(`${window.server}/WsConf/params/get/sys/SSO_POST_KEY`).then(res => {
                if (res.data) {
                    setKey(res.data['VALUE'])
                }
            })
            setData(window.userObject || {})
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.delete('userObject'); // Remove the userObject parameter
            const newURL = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}${window.location.hash}`;
            window.history.replaceState({}, document.title, newURL);
        }
    }, [])

    const submutSsoRegister = (e) => {
        let url = window.server + '/SvSecurity/sso'
        let data = new URLSearchParams()
        data.append(`${key}`, JSON.stringify(e.formData))
        axios({
            method: 'post',
            data,
            url,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).then((res) => {
            if (res.data) {
                const resType = res.data?.type?.toLowerCase() || 'info'
                let title = ''
                if (resType === 'success') {
                    title = intl.formatMessage({ id: 'perun.admin_console.success_label', defaultMessage: 'perun.admin_console.success_label' })
                }
                alertUserV2({ type: resType, title })
            }
        }).catch(err => {
            console.error(err)
            alertUserResponse({ response: err })
        });
    }

    const renderForm = () => {
        const { uiSchema, schema, formData } = getRegisterSsoForm(intl, data)
        return <Form
            uiSchema={uiSchema}
            schema={schema}
            key={'SVAROG_USERS_SSO'}
            formData={formData}
            className={`customForm perun-core-form registration-form registration-form-sso`}
            validator={validator}
            onSubmit={submutSsoRegister}
        >
            <></>
            <div className='admin-console-label-form-btn-container'>
                <button className='btn-success btn_save_form' type='submit'>
                    {intl.formatMessage({ id: 'perun.login.register', defaultMessage: 'perun.login.register' })}
                </button>
            </div>
        </Form>
    }

    return (
        <React.Fragment>
            <div className='linkFormHolder'>
                <div className='admin-console-register-sso'>
                    {renderForm()}
                </div>
            </div>
        </React.Fragment>
    );
};

export default RegistrationSso;
