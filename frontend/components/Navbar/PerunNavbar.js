import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import { Icon } from "../../elements"
import { downloadFile, getServerOrigin } from '../../functions/utils';
import { alertUserResponse } from '../../elements'
import axios from 'axios';
import { createHashHistory } from 'history';
import NavbarHelp from './NavbarHelp'
const PerunNavbar = (props, context) => {
    let hashHistory = createHashHistory();
    const [toggleNavOpt, setToggleNavOpt] = useState(false)
    const [menuBurger, setMenuBurger] = useState(undefined)
    const [toggleBurger, setToggleBurger] = useState(false)
    const [img, setImg] = useState(undefined);
    const [tasksLength, setTasksLength] = useState(0)
    const navOptRef = useRef(null);
    const burgerRef = useRef(null);

    useEffect(() => {
        if (props.userInfo.avatar) {
            downloadFile(props.userInfo.avatar, props.svSession, setImg)
        }
        function handleClickOutside(event) {
            if (navOptRef.current && !navOptRef.current.contains(event.target)) {
                setToggleNavOpt(false)
            }
            if (burgerRef.current && !burgerRef.current.contains(event.target)) {
                setToggleBurger(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (props.userInfo.avatar && props.userInfo.avatar.objectId) {
            downloadFile(props.userInfo.avatar, props.svSession, setImg)
        } else {
            setImg(undefined)
        }
    }, [props.userInfo])

    const showBurgerMenu = () => {
        setMenuBurger(JSON.parse(localStorage.getItem('bundleStorage')))
        setToggleBurger(true)
    }

    useEffect(() => {
        if (props.renderTasks) {
            axios.get(window.server + `/WsControlProgram/getTaskCountByResponsibleVet/${props.svSession}`).then(res => {
                if (res?.data?.data?.count && res?.data?.data?.count > 0) {
                    setTasksLength(res?.data?.data?.count)
                }
            }).catch(err => {
                console.error(err)
                alertUserResponse({ response: err })
            })
        }
    }, [props.renderTasks]);

    return (
        <>
            <div className='perun-navbar'>
                {/* navbar start */}
                <div className='nav-title-start'>
                    <Link to='/main' className='nav-icon' title='Home'>
                        {<Icon name="IconHome" />}
                    </Link>
                    <div className={`nav-icon-with-title ${toggleBurger && 'active'}`} title={context.intl.formatMessage({ id: 'perun.navbar.menu', defaultMessage: 'perun.navbar.menu' })} onClick={() => showBurgerMenu()}>
                        {<Icon name="IconCategory" />}
                        <p>{context.intl.formatMessage({ id: 'perun.navbar.menu', defaultMessage: 'perun.navbar.menu' })}</p>
                    </div>
                </div>
                {/* idscreen */}
                <div className='nav-title'>
                    <p id='identificationScreen'></p>
                </div>
                <div className='nav-task-user'>
                    <NavbarHelp />
                    {props.renderTasks && (
                        <div className='nav-title-tasks' onClick={() => {
                            hashHistory.push('/main/control-programs/user-controls/')
                        }}>
                            {<Icon name="IconCards" />}
                            {tasksLength > 0 && <p className='nav-tasks-length'>{tasksLength}</p>}
                        </div>
                    )}
                    {/* navbar end */}
                    <div onClick={() => setToggleNavOpt(true)} className={`nav-title-end ${toggleNavOpt && 'active'}`}>
                        <div className='nav-icon-with-title'>
                            {img ? <img className="my-profile-icon-avatar" src={img} alt="User Avatar" /> : <Icon name="IconUser" />} <p>{props.userInfo.username}</p> </div>
                        <div className='perun-navbar-arrow'>{<Icon name="IconChevronDown" />}</div>
                    </div>
                </div>
                {/* navbar end toggle */}
                {toggleNavOpt && (
                    <div ref={navOptRef} className='nav-options'>
                        <div className='nav-option no-event'>
                            <p>{context.intl.formatMessage({ id: 'perun.navbar.usergr', defaultMessage: 'perun.navbar.usergr' })}</p>
                            <p>{props.userInfo?.defaultUserGroup?.groupName}</p>
                        </div>
                        {props?.languageOptions && props?.languageOptions.map(lang => (
                            <div key={lang.locale} className={`nav-option ${props?.activeLanguage == lang?.language && 'nav-active-lang'}`} onClick={() => { props.changeLang(lang.locale, lang.language), setToggleNavOpt(false) }}>
                                <p>{lang.label}</p>
                            </div>
                        ))}
                        <Link className='nav-option' to='/main/my-profile' onClick={() => setToggleNavOpt(false)} title={context.intl.formatMessage({ id: 'perun.navbar.edit', defaultMessage: 'perun.navbar.edit' })}>
                            {<Icon name='IconEdit' />}
                            <p>{context.intl.formatMessage({ id: 'perun.navbar.edit', defaultMessage: 'perun.navbar.edit' })}</p>
                        </Link>
                        <div className='nav-option' onClick={() => { props.logout(), setToggleNavOpt(false) }} title={context.intl.formatMessage({ id: 'perun.navbar.logout', defaultMessage: 'perun.navbar.logout' })}>
                            {<Icon name="IconLogout" />}
                            <p>{context.intl.formatMessage({ id: 'perun.navbar.logout', defaultMessage: 'perun.navbar.logout' })}</p>
                        </div>
                    </div>
                )}
            </div>
            {/* burger menu */}
            {toggleBurger && (
                <div ref={burgerRef} className='nav-burger-menu'>
                    {menuBurger.map(el => (
                        !el['cardHidden'] && (
                            <Link key={el.id} className='nav-burger-option' to={`/main/${el.id}`} onClick={() => setToggleBurger(false)}>
                                <div className='nav-burger-img'>
                                    <img src={`${getServerOrigin()}${el.imgPath}`} />
                                </div>
                                <p>{el.title}</p>
                            </Link>
                        )
                    ))}
                </div>
            )}
        </>
    );
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
    userInfo: state.userInfo
})

PerunNavbar.contextTypes = {
    intl: PropTypes.object.isRequired
}

export default connect(mapStateToProps)(PerunNavbar)
