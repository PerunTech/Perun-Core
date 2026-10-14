import React from 'react';
import { connect } from 'react-redux';
import { Icon } from "../../../elements"
const { useState } = React;

const SideMenu = (props) => {
    const [activeElement, setActiveElement] = useState('');
    const [activeChild, setActiveChild] = useState('');
    const [activeParent, setActiveParent] = useState('');

    const generateSideMenuButtons = (configuration) => {
        if (configuration && Array.isArray(configuration)) {
            return configuration.map(el => {
                let _modifiedID = el.ID?.replace(/\d/g, '')?.replace(/_$/, '');
                if (!el.ID?.toUpperCase()?.includes('SUMMARY')) {
                    return (
                        <>
                            <button id={el.ID} className={`sidemenu-btn_sub ${activeElement === el.ID && !el.data && 'sidemenu-active'}`}
                                onClick={() => (el.data ? setActive(el) : onButtonClick(el))}>
                                <span className='sidemenu-btn-title'><p>{el?.label || el?.LABEL}</p></span>
                                {el.data && (<span className={`expand-arrow ${el.ID === activeParent && 'rotate-expand'}`}>{<Icon name="IconChevronDown" />}</span>)}
                            </button>
                            {el.data && (
                                <div className={el.ID === activeParent ? 'sidemenu-sub-item-active' : 'sidemenu-sub-item-hidden'}>
                                    {el.data.map(sub => {
                                        _modifiedID = sub.ID?.replace(/\d/g, '')?.replace(/_$/, '');
                                        return (<button key={sub.ID} className={`sidemenu-btn_sub ${activeChild === sub.ID && 'sidemenu-active'}`}>
                                            <span className="sidemenu-btn-title"><p>{sub?.label || sub?.LABEL}</p>  </span> </button>);
                                    })}
                                </div>
                            )}
                        </>
                    );
                }
            });
        } else { return <></>; }

    };
    const onButtonClick = (element, childEl) => {
        const id = element.ID;
        if (childEl) {
            setActiveChild(id)
            setActiveElement('')
        } else {
            setActiveElement(id)
            setActiveChild('')
        }
    }

    const setActive = (el) => {
        if (el.ID === activeParent) {
            setActiveParent('');
        } else { setActiveParent(el.ID); }

    };
    return (
        <div className='preview-menu-container'>
            {props.configuration && <div className={`sidemenu-main-container preview-sidemenu`} id="sidemenu-main-container"> {generateSideMenuButtons(props.configuration)}</div>}
        </div>
    );
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

export default connect(mapStateToProps)(SideMenu);