import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { GenericForm } from '../../../client';
import { strcmp } from '../../../model/utils';
import Swal from 'sweetalert2';
import md5 from 'md5';
import { alertUserResponse, Icon } from '../../../elements';
import axios from 'axios';

const PasswordWidget = ({ value, onChange }) => {
    const [visible, setVisible] = useState(false);
    return (
        <div className='my-profile-password-widget'>
            <input
                type={visible ? 'text' : 'password'}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className='my-profile-password-input'
            />
            <button
                type='button'
                className='my-profile-toggle-visibility'
                onClick={() => setVisible(!visible)}
            >
                {visible ? <Icon name='IconEyeOff' /> : <Icon name='IconEye' />}
            </button>
        </div>
    );
};

const widgets = { passwordWidget: PasswordWidget };

const PasswordForm = (props) => {
    const { isNewUser, isEdit, svSession, userInfo, onSave, setShow } = props;
    const intl = useIntl();
    const fmt = (id) => intl.formatMessage({ id, defaultMessage: id });

    const [passwordMatch, setPasswordMatch] = useState(false);
    const [formDat, setFormDat] = useState({});

    const schema = {
        title: fmt(isNewUser ? 'perun.my_profile.set_user_password' : 'perun.my_profile.change_password'),
        type: 'object',
        properties: {
            confUserPassword: { type: 'string', title: fmt('perun.my_profile.confirm_password') },
            userPassword: { type: 'string', title: fmt('perun.my_profile.password') },
            ...(!isNewUser && { oldPassword: { type: 'string', title: fmt('perun.my_profile.old_password') } }),
        },
        required: ['confUserPassword', 'userPassword', ...(!isNewUser ? ['oldPassword'] : [])],
    };

    const uiSchema = {
        confUserPassword: { 'ui:widget': 'passwordWidget', 'ui:helpCode': 'perun.my_profile.form.confUserPassword.help' },
        userPassword: { 'ui:widget': 'passwordWidget', 'ui:helpCode': 'perun.my_profile.form.userPassword.help' },
        ...(!isNewUser && { oldPassword: { 'ui:widget': 'passwordWidget', 'ui:helpCode': 'perun.my_profile.form.oldPassword.help' } }),
    };

    const handleSubmit = ({ formData }) => {
        setFormDat(formData);

        if (!strcmp(formData.confUserPassword, formData.userPassword)) {
            setPasswordMatch(true);
            return;
        }

        setPasswordMatch(false);

        if (isNewUser) {
            onSave(formData);
            return;
        }

        if (isEdit) setShow(false);
        if (!isEdit) Swal.close();

        const data = {
            ...formData,
            userName: userInfo.username,
            userPassword: md5(formData.userPassword).toUpperCase(),
            confUserPassword: md5(formData.confUserPassword).toUpperCase(),
            oldPassword: md5(formData.oldPassword).toUpperCase(),
        };

        axios.post(
            `${window.server}/WsAdminConsole/changePassword/${svSession}`,
            JSON.stringify(data),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )
            .then(res => alertUserResponse({ response: res }))
            .catch(err => alertUserResponse({ response: err, type: 'error' }));
    };

    return (
        <GenericForm
            params='FORM_DATA'
            className={`my-profile-change-password${isNewUser ? ' add-user-password-form' : ''}`}
            key='PASSWORD_FORM'
            id='PASSWORD_FORM'
            method={schema}
            uiSchemaConfigMethod={uiSchema}
            tableFormDataMethod={formDat}
            additionalWidgets={widgets}
            addSaveFunction={handleSubmit}
            hideBtns='closeAndDelete'

        >
            <div>
                <p className='dont-match'>{passwordMatch ? fmt('perun.my_profile.password_dont') : ''}</p>
            </div>
            <div className='my-profile-alert-btns'>
                <div className='cancel-btn' onClick={() => isEdit ? setShow(false) : Swal.close()}>
                    {fmt('perun.my_profile.cancel')}
                </div>
                <button className='btn btn-info' type='submit'>{fmt('perun.adminConsole.save')}</button>
            </div>
        </GenericForm>
    );
};

export default PasswordForm;
