import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

/**
 * Guards a route behind a selector over the redux store.
 *
 * Renders the guarded component while `authenticatedSelector` holds, falls back to
 * `AuthenticatingComponent` while `authenticatingSelector` holds, and otherwise replaces
 * the current history entry with `redirectPath`.
 *
 * Replaces `redux-auth-wrapper`'s `connectedRouterRedirect` for the subset of its behaviour
 * this module relies on: no `allowRedirectBack`, so no `?redirect=` round trip and none of
 * the `query-string` / `url` machinery that came with it.
 *
 * @param {Object} config - The guard configuration.
 * @param {string|Function} config.redirectPath - Path to redirect to, or a (state, ownProps) selector returning one.
 * @param {Function} config.authenticatedSelector - (state, ownProps) => boolean, renders the guarded component when true.
 * @param {Function} [config.authenticatingSelector] - (state, ownProps) => boolean, renders AuthenticatingComponent when true.
 * @param {React.ComponentType} [config.AuthenticatingComponent] - Rendered while authenticating.
 * @param {string} [config.wrapperDisplayName] - Display name given to the generated wrapper.
 * @returns {Function} - HOC taking the component to guard.
 */
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
