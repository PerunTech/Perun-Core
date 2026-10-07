import React, { lazy } from 'react';
import { Configurator } from '../../loadConfiguration';
import { routeGuard } from '../routeGuard';
import { svSessionRegxp } from '../../model';
import { Loading } from '../../components/ComponentsIndex';

const UserIsNotAuthenticatedSoNeverEnter = routeGuard({
    redirectPath: '/',
    authenticatedSelector: state => svSessionRegxp(state.security.svSession),
    authenticatingSelector: state => state.security.isBusy,
    // Want to redirect the user when they are done loading and authenticated
    wrapperDisplayName: 'UserIsNotAuthenticatedSoNeverEnter',
    AuthenticatingComponent: Loading
});
const ModuleMenu = UserIsNotAuthenticatedSoNeverEnter(lazy(() => import('../../components/Menus/ModuleMenu')))
const Component = props => {
    return <Configurator key='ModuleMenuConfigurator' type='MODULE_MENU'>
        <ModuleMenu {...props} />
    </Configurator>
};

export const Main = {
    path: '/main',
    render: Component,
    isExact: true
};