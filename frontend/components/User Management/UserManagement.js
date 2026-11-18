import React from 'react';
import { useIntl } from 'react-intl';
import People from './People/People';
import GroupsSection from './Groups/GroupsSection';
import PermissionCodes from './Codes/PermissionCodes';
import AccessCheck from './AccessCheck/AccessCheck';
import AdminConsoleHelpButton from '../AdminConsole/Help/AdminConsoleHelpButton';

// The first path part after the section is an area, or a user for the People area.
const TABS = [
    ['', 'perun.people.title'],
    ['groups', 'perun.user_mng_groups'],
    ['codes', 'perun.user_mng.codes'],
    ['check', 'perun.user_mng.check']
];
const AREAS = TABS.map(([key]) => key).filter(Boolean);

const UserManagement = ({ id, tab, sub, navigate }) => {
    const intl = useIntl()
    const area = AREAS.includes(id) ? id : ''
    const open = (key) => (key ? navigate(key) : navigate())

    return (
        <div className='user-mng'>
            <div className='user-mng-header admin-console-component-header'>
                <p>{intl.formatMessage({ id: 'perun.user_mng', defaultMessage: 'perun.user_mng' })}</p>
                <AdminConsoleHelpButton title={{ id: 'perun.user_mng', defaultMessage: 'perun.user_mng' }} />
            </div>
            {/* Divs, not buttons: the deployments' stylesheets style .user-tab-title as one. */}
            <div className='user-mng-tabs' role='tablist'>
                {TABS.map(([key, label]) => (
                    <div
                        key={key || 'people'}
                        role='tab'
                        tabIndex={0}
                        aria-selected={area === key}
                        className={area === key ? 'user-tab-title active' : 'user-tab-title'}
                        onClick={() => open(key)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                open(key);
                            }
                        }}
                    >
                        <p>{intl.formatMessage({ id: label, defaultMessage: label })}</p>
                    </div>
                ))}
            </div>
            <div>
                {area === '' && <People id={id} tab={tab} navigate={navigate} />}
                {area === 'groups' && (
                    <GroupsSection
                        id={tab}
                        tab={sub}
                        navigate={(...parts) => navigate('groups', ...parts)}
                        openPerson={(personId) => navigate(personId)}
                    />
                )}
                {area === 'codes' && <PermissionCodes openGroup={(groupId) => navigate('groups', groupId, 'permissions')} />}
                {area === 'check' && <AccessCheck openPerson={(personId) => navigate(personId, 'access')} />}
            </div>
        </div>
    );
};

export default UserManagement;
