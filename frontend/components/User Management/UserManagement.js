import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import People from './People/People';
import Groups from './Groups/Groups';
import Privileges from './Privileges/Privileges';
import AdminConsoleHelpButton from '../AdminConsole/Help/AdminConsoleHelpButton';

const TABS = [
    ['USERS', 'perun.people.title'],
    ['GROUPS', 'perun.user_mng_groups'],
    ['PRIVILEGES', 'perun.admin_console.manage_priviledges']
];

const UserManagement = ({ id, tab, navigate }) => {
    const intl = useIntl()
    const [activeTab, setActiveTab] = useState('USERS');

    useEffect(() => {
        if (id) setActiveTab('USERS')
    }, [id])

    const setActiveFunc = (next) => {
        setActiveTab(next);
        if (id) navigate();
    };

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
                        key={key}
                        role='tab'
                        tabIndex={0}
                        aria-selected={activeTab === key}
                        className={activeTab === key ? 'user-tab-title active' : 'user-tab-title'}
                        onClick={() => setActiveFunc(key)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveFunc(key);
                            }
                        }}
                    >
                        <p>{intl.formatMessage({ id: label, defaultMessage: label })}</p>
                    </div>
                ))}
            </div>
            <div>
                {activeTab === 'USERS' && <People id={id} tab={tab} navigate={navigate} />}
                {activeTab === 'GROUPS' && <Groups />}
                {activeTab === 'PRIVILEGES' && <Privileges />}
            </div>
        </div>
    );
};

export default UserManagement;
