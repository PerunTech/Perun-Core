import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import Users from './Users/Users';
import Groups from './Groups/Groups';
import Privileges from './Privileges/Privileges';
import AdminConsoleHelpButton from '../AdminConsole/Help/AdminConsoleHelpButton';

const UserManagement = () => {
    const intl = useIntl()
    const [activeTab, setActiveTab] = useState('USERS');

    const setActiveFunc = (tab) => {
        setActiveTab(tab);
    };

    const getTabClass = (tab) => (tab === activeTab ? 'user-tab-title active' : 'user-tab-title');

    return (
        <div className='user-mng'>
            <div className='user-mng-header admin-console-component-header'>
                <p>{intl.formatMessage({ id: 'perun.user_mng', defaultMessage: 'perun.user_mng' })}</p>
                <AdminConsoleHelpButton title={{ id: 'perun.user_mng', defaultMessage: 'perun.user_mng' }} />
            </div>
            <div className='user-mng-tabs'>
                <div onClick={() => setActiveFunc('USERS')} className={getTabClass('USERS')}>
                    <p>{intl.formatMessage({ id: 'perun.adminConsole.users', defaultMessage: 'perun.adminConsole.users' })}</p>
                </div>
                <div onClick={() => setActiveFunc('GROUPS')} className={getTabClass('GROUPS')}>
                    <p>
                        {intl.formatMessage({ id: 'perun.user_mng_groups', defaultMessage: 'perun.user_mng_groups' })}
                    </p>
                </div>
                <div onClick={() => setActiveFunc('PRIVILEGES')} className={getTabClass('PRIVILEGES')}>
                    <p>
                        {intl.formatMessage({ id: 'perun.admin_console.manage_priviledges', defaultMessage: 'perun.admin_console.manage_priviledges' })}
                    </p>
                </div>
            </div>
            <div>
                {activeTab === 'USERS' && <Users />}
                {activeTab === 'GROUPS' && <Groups />}
                {activeTab === 'PRIVILEGES' && <Privileges />}
            </div>
        </div>
    );
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

export default connect(mapStateToProps)(UserManagement);
