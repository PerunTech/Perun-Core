import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { Icon } from '../../elements'

const SideMenu = (props) => {
    const intl = useIntl();
    const [activeElement, setActiveElement] = useState('UserManagement');
    const generateSideMenuButtons = () => {
        if (props.json && Array.isArray(props.json)) {
            return props.json.map(el => {
                return (
                    <div
                        key={el.id}
                        className={activeElement === el.component ? 'admin-console-side-item active' : 'admin-console-side-item'}
                        onClick={() => (onButtonClick(el))}
                    >
                        {<span className={'sidemenu-dynamic-comp-icon-holder'}>{<Icon name={el.icon} />}</span>}<p>{intl.formatMessage({
                            id: `perun.admin_console.${el.id}`,
                            defaultMessage: `perun.admin_console.${el.id}`
                        })}</p>
                    </div>
                );

            });
        } else {
            return <></>;
        }
    }
    const onButtonClick = (element) => {
        if (element.component) {
            props.setDynamicComponentFunction(element.component)
            setActiveElement(element.component)
        }
    }

    return (
        <>
            <div className={`admin-console-side-menu`}>
                {generateSideMenuButtons()}
            </div>
        </>
    )
}
const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

export default connect(mapStateToProps)(SideMenu);