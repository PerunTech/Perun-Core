import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

// The component while authenticatedSelector holds, AuthenticatingComponent while authenticatingSelector
// does, else a replace to redirectPath (a path, or a selector returning one).
export const routeGuard = ({
    redirectPath,
    authenticatedSelector,
    authenticatingSelector = () => false,
    AuthenticatingComponent = () => null,
    wrapperDisplayName = 'RouteGuard'
}) => {
    const selectRedirectPath = typeof redirectPath === 'function' ? redirectPath : () => redirectPath;

    const mapStateToProps = (state, ownProps) => ({
        redirectPath: selectRedirectPath(state, ownProps),
        isAuthenticated: authenticatedSelector(state, ownProps),
        isAuthenticating: authenticatingSelector(state, ownProps)
    });

    return DecoratedComponent => {
        const Guard = props => {
            if (props.isAuthenticated) {
                return <DecoratedComponent {...props} />;
            }
            if (props.isAuthenticating) {
                return <AuthenticatingComponent {...props} />;
            }
            return <Redirect to={props.redirectPath} />;
        };
        Guard.displayName = `${wrapperDisplayName}(${DecoratedComponent.displayName || DecoratedComponent.name || 'Component'})`;

        return connect(mapStateToProps)(Guard);
    };
};
