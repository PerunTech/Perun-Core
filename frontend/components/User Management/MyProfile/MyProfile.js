import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import ReactDOM from 'react-dom';
import { GenericForm, Loading, axios, createHashHistory, ComponentManager } from '../../../client';
import { downloadFile } from '../../../functions/utils';
import { alertUserV2, alertUserResponse, Icon, ReactBootstrap } from '../../../elements';
import { store } from '../../../model';
import PasswordForm from './PasswordForm';
const { Modal } = ReactBootstrap

const MyProfile = (props, context) => {
    const history = createHashHistory()
    const [loading, setLoading] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [img, setImg] = useState(undefined);
    const avatarInputRef = useRef(null);
    useEffect(() => {
        const idScreen = document.getElementById('identificationScreen')
        if (idScreen) {
            idScreen.innerText = context.intl.formatMessage({ id: 'perun.my_profile', defaultMessage: 'perun.my_profile' });
        }
    }, []);

    useEffect(() => {
        if (props?.userInfo?.avatar?.objectId && props?.userInfo?.avatar?.fileName) {
            downloadFile(props.userInfo.avatar, props.svSession, setImg)
        } else {
            setImg(undefined)
        }
    }, [props.userInfo.avatar, props.svSession]);

    const handleBack = () => {
        // If the history size is larger than 2, it means the user has already been navigating through the app
        if (history.length > 2) {
            history.goBack()
        } else {
            history.push('/main')
        }
    }

    const uploadFile = (file) => {
        setLoading(true);
        const data = new FormData();
        data.append('file', file);
        axios({
            method: 'post',
            data: data,
            url: `${window.server}/ReactElements/uploadAvatar/sid/${props.svSession}`,
        }).then(res => {
            setLoading(false);
            if (res?.data) {
                const resType = res.data?.type?.toLowerCase() || 'info'
                alertUserResponse({ type: resType, response: res })
                if (resType === 'success') {
                    const objectId = res?.data?.data?.objectId || res?.data?.objectId
                    const fileName = res?.data?.data?.fileName || res?.data?.fileName || file?.name || ''
                    const updatedUserInfo = {
                        ...props.userInfo,
                        avatar: {
                            ...(props.userInfo.avatar || {}),
                            objectId,
                            fileName,
                        },
                    }
                    store.dispatch({ type: 'GET_CURRENT_USER_DATA', payload: updatedUserInfo })
                    downloadFile(updatedUserInfo.avatar, props.svSession, setImg)
                }
            }
        }).catch(err => {
            console.error(err);
            setLoading(false);
            alertUserResponse({ response: err })
        });
    }

    const previewAndUpload = (file) => {
        const fileReader = new FileReader()
        fileReader.onloadend = () => {
            const customElement = document.createElement('div')
            ReactDOM.render((
                <div className='my-profile-preview-img'>
                    <img src={fileReader.result} />
                </div>
            ), customElement)
            const confirmLabel = context.intl.formatMessage({ id: 'perun.my_profile.set_new_avatar', defaultMessage: 'perun.my_profile.set_new_avatar' })
            const cancelLabel = context.intl.formatMessage({ id: 'perun.my_profile.cancel', defaultMessage: 'perun.my_profile.cancel' })
            const alertParams = {
                confirmButtonText: confirmLabel,
                onConfirm: () => uploadFile(file),
                showCancel: true,
                cancelButtonText: cancelLabel,
                html: customElement
            }
            alertUserV2(alertParams)
        }
        fileReader.readAsDataURL(file)
    }

    const handlePhotoSelection = (e) => {
        const fileTooLargeLabel = context.intl.formatMessage({ id: 'perun.my_profile.file_too_large', defaultMessage: 'perun.my_profile.file_too_large' });
        const notAPhotoLabel = context.intl.formatMessage({ id: 'perun.my_profile.not_a_photo', defaultMessage: 'perun.my_profile.not_a_photo' });
        const photoHeadersArr = ['89504e47', '47494638', 'ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8']
        e.preventDefault()
        const fileInput = e.target
        const selectedFiles = []

        Object.values(fileInput.files).forEach(file => {
            if ((file.size / 1024).toFixed(2) < 200) {
                selectedFiles.push(file)
                let header = ''

                const fileReader = new FileReader()
                fileReader.onloadend = e => {
                    let arr = (new Uint8Array(e.target.result)).subarray(0, 4)
                    for (let i = 0; i < arr.length; i++) {
                        header += arr[i].toString(16)
                    }
                    if (header && photoHeadersArr.includes(header)) {
                        previewAndUpload(file)
                        header = ''
                    } else {
                        alertUserV2({ type: 'info', title: notAPhotoLabel })
                    }
                }
                fileReader.readAsArrayBuffer(file)
            } else {
                alertUserV2({ type: 'info', title: fileTooLargeLabel })
            }
        })
        fileInput.value = ''
    }

    const deleteDownload = (e) => {
        const titleLabel = context.intl.formatMessage({ id: 'perun.my_profile.remove_current_avatar', defaultMessage: 'perun.my_profile.remove_current_avatar' })
        const confirmLabel = context.intl.formatMessage({ id: 'perun.my_profile.confirm', defaultMessage: 'perun.my_profile.confirm' })
        const cancelLabel = context.intl.formatMessage({ id: 'perun.my_profile.cancel', defaultMessage: 'perun.my_profile.cancel' })
        const onConfirm = () => {
            e.preventDefault()
            if (props?.userInfo?.avatar?.objectId) {
                setLoading(true)
                const deleteObj = { 'OBJECT_ID': props.userInfo.avatar['objectId'], 'OBJECT_TYPE': 2 }
                const url = window.server + `/ReactElements/deleteObject/${props.svSession}`
                axios({
                    method: "post",
                    data: JSON.stringify(deleteObj),
                    url: url,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                }).then((res) => {
                    setLoading(false)
                    if (res?.data) {
                        const resType = res.data?.type?.toLowerCase() || 'info'
                        alertUserResponse({ type: resType, response: res })
                        if (resType === 'success') {
                            setImg(undefined)
                            const updatedUserInfo = {
                                ...props.userInfo,
                                avatar: undefined,
                            }
                            store.dispatch({ type: 'GET_CURRENT_USER_DATA', payload: updatedUserInfo })
                            if (avatarInputRef.current) {
                                avatarInputRef.current.value = ''
                            }
                        }
                    }
                }).catch(err => {
                    console.error(err)
                    setLoading(false)
                    alertUserResponse({ response: err })
                });
            } else {
                alertUserV2({ type: 'info', title: context.intl.formatMessage({ id: 'perun.my_profile.no_avatar_to_remove', defaultMessage: 'perun.my_profile.no_avatar_to_remove' }) })
            }

        }
        const alertParams = {
            type: 'warning',
            title: titleLabel,
            confirmButtonText: confirmLabel,
            confirmButtonColor: '#8d230f',
            onConfirm,
            showCancel: true,
            cancelButtonText: cancelLabel
        }
        alertUserV2(alertParams)
    }

    const changePassword = () => setShowPasswordModal(true)

    const handleEditProfile = (e) => {
        let url = `${window.server}/WsAdminConsole/editUser/${props.svSession}/${props.userInfo.userObjectId}`
        axios({
            method: "post",
            data: encodeURIComponent(JSON.stringify(e.formData)),
            url,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then((res) => {
            alertUserResponse({ response: res })
            ComponentManager.setStateForComponent('MY_PROFILE_FORM', null, {
                saveExecuted: false,
            });
        }).catch(err => {
            alertUserResponse({ response: err, type: 'error' })
            ComponentManager.setStateForComponent('MY_PROFILE_FORM', null, {
                saveExecuted: false,
            });
        });
    };
    return (
        <div className="my-profile">
            {loading && <Loading />}
            <div className="my-profile-form-container">
                <div className="my-profile-icon-holder">
                    <div className="my-profile-avatar">
                        <p className="my-profile-title-large">{context.intl.formatMessage({ id: 'perun.my_profile.user_avatar', defaultMessage: 'perun.my_profile.user_avatar' })}</p>
                        <p>{context.intl.formatMessage({ id: 'perun.my_profile.change_or_remove_avatar', defaultMessage: 'perun.my_profile.change_or_remove_avatar' })}</p>
                    </div>
                    <div className="my-profile-icon">
                        {img ? <img className="my-profile-icon-avatar" src={img} alt={context.intl.formatMessage({ id: 'perun.my_profile.user_avatar_alt', defaultMessage: 'perun.my_profile.user_avatar_alt' })} /> : <Icon name="IconUserFilled" />}
                    </div>
                    <div className="my-profile-upload">
                        <p className="my-profile-title-medium">{context.intl.formatMessage({ id: 'perun.my_profile.upload_new_avatar', defaultMessage: 'perun.my_profile.upload_new_avatar' })}</p>
                        <input type="file" onChange={handlePhotoSelection} ref={avatarInputRef} />
                        <p className="my-profile-title-small">{context.intl.formatMessage({ id: 'perun.my_profile.max_file_size', defaultMessage: 'perun.my_profile.max_file_size' })}</p>
                        <div onClick={(e) => deleteDownload(e)} className="my-profile-remove">
                            <p>{context.intl.formatMessage({ id: 'perun.my_profile.remove_avatar', defaultMessage: 'perun.my_profile.remove_avatar' })}</p>
                        </div>
                    </div>
                </div>
                <div className="my-profile-edit">
                    <p className="my-profile-title-large">{context.intl.formatMessage({ id: 'perun.my_profile.edit_profile', defaultMessage: 'perun.my_profile.edit_profile' })}</p>
                    <div className="my-profile-remove" onClick={() => changePassword()}>
                        <p>{context.intl.formatMessage({ id: 'perun.my_profile.change_password', defaultMessage: 'perun.my_profile.change_password' })}</p>
                    </div>
                </div>
                <GenericForm
                    params="READ_URL"
                    key="MY_PROFILE_FORM"
                    id="MY_PROFILE_FORM"
                    method={`/ReactElements/getTableJSONSchema/${props.svSession}/SVAROG_USERS`}
                    uiSchemaConfigMethod={`/WsAdminConsole/getUsersTableUISchema/${props.svSession}`}
                    tableFormDataMethod={`/ReactElements/getTableFormData/${props.svSession}/${props.userInfo.userObjectId || 0}/SVAROG_USERS`}
                    addSaveFunction={handleEditProfile}
                    hideBtns="closeAndDelete"
                    className="hide-all-form-legends my-profile-form"
                    helpSectionId='SVAROG_USERS'
                    noValidate={true}
                />
                <div className='my-profile-back-btn' onClick={() => handleBack()}>
                    <div className='my-profile-back-btn-icon'>
                        <i className='fas fa-chevron-left' />
                    </div>
                    <p>{context.intl.formatMessage({ id: 'perun.my_profile.back', defaultMessage: 'perun.my_profile.back' })}</p>
                </div>
            </div>
            {showPasswordModal && (
                <Modal className='admin-console-unit-modal edit-user-password-modal' show={showPasswordModal} onHide={() => setShowPasswordModal(false)}>
                    <Modal.Header className='admin-console-unit-modal-header' closeButton />
                    <Modal.Body className='admin-console-unit-modal-body'>
                        <PasswordForm
                            userInfo={props.userInfo}
                            svSession={props.svSession}
                            context={context}
                            isEdit
                            setShow={setShowPasswordModal}
                        />
                    </Modal.Body>
                    <Modal.Footer className='admin-console-unit-modal-footer' />
                </Modal>
            )}
        </div>
    );
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
    userInfo: state.userInfo,
});

MyProfile.contextTypes = {
    intl: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(MyProfile);
