import React, { useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, Loading, axios } from '../../../client'
import { alertUserResponse } from '../../../elements'
import PasswordForm from '../MyProfile/PasswordForm'
import md5 from 'md5';
const AddUserWrapper = (props) => {
    const [loading, setLoading] = useState(false)
    const onSave = (data) => {
        setLoading(true)
        const { formid } = props
        const formData = ComponentManager.getStateForComponent(
            formid,
            "formTableData"
        );
        formData['PASSWORD_HASH'] = md5(data.userPassword).toUpperCase()
        formData['CONFIRM_PASSWORD_HASH'] = md5(data.confUserPassword).toUpperCase()
        const url = `${window.server}/WsAdminConsole/saveUser/${props.svSession}`
        axios.post(url, encodeURIComponent(JSON.stringify(formData)), { headers: { "Content-Type": "application/x-www-form-urlencoded" } })
            .then(res => {
                setLoading(false)
                alertUserResponse({ response: res })
                const afterSaveCleanUp = ComponentManager.getStateForComponent(
                    formid,
                    "afterSaveCleanUp"
                );
                afterSaveCleanUp()
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
                alertUserResponse({ response: err, type: 'error' })
            });
    }
    return (
        <>
            {loading && <Loading />}
            {props.children}
            <PasswordForm svSession={props.svSession} isNewUser={true} onSave={onSave} />
        </>
    )
}
const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
})
export default connect(mapStateToProps)(AddUserWrapper)