import React from 'react'
import { useIntl } from 'react-intl'
import { Icon } from '../../elements'

const SideMenu = ({ json, active, onSelect }) => {
    const intl = useIntl();
    if (!Array.isArray(json)) return null
    return (
        <div className={`admin-console-side-menu`}>
            {json.map(el => (
                <div
                    key={el.id}
                    className={active === el.component ? 'admin-console-side-item active' : 'admin-console-side-item'}
                    onClick={() => el.component && onSelect(el.component)}
                >
                    {<span className={'sidemenu-dynamic-comp-icon-holder'}>{<Icon name={el.icon} />}</span>}<p>{intl.formatMessage({
                        id: `perun.admin_console.${el.id}`,
                        defaultMessage: `perun.admin_console.${el.id}`
                    })}</p>
                </div>
            ))}
        </div>
    )
}

export default SideMenu
