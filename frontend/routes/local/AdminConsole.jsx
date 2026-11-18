import React from 'react';
import AdminConsole from '../../components/AdminConsole/AdminConsole'
import { ADMIN_CONSOLE_PATH } from '../../components/AdminConsole/adminConsolePath'

const Component = props => {
    return <AdminConsole {...props} />
};

export const AdminConsoleRoute = {
    path: `${ADMIN_CONSOLE_PATH}/:section?/:id?/:tab?/:sub?`,
    render: Component,
    isExact: true
};
