import React, { Suspense, useState } from 'react';
import { Router as ReactRouter, Switch, Redirect } from 'react-router-dom';
import { createHashHistory } from 'history';
import { Loading, Footer, HomeMenu } from '../components/ComponentsIndex';
import { connect } from 'react-redux';

const Routes = (props) => {
    // Made once: Router keeps the history it was first given and warns on every render that brings another.
    const [history] = useState(() => createHashHistory({ basename: '/' }))
    return (
        <ReactRouter history={history} >
            <Suspense fallback={<Loading />}>
                {props.fetchingRoutes ? <Loading /> : (
                    <React.Fragment>
                        <HomeMenu />
                        <Switch>
                            <Redirect exact from='/' to='/home/login' /> {/* this can be moved to our Home route, on top. */}
                            {/* ------------------------------------------------------------------------------ */}
                            {/* Render all routes currently registered with our Router. */}
                            {Object.values(props.routes).map(route => route)}
                            {/* ------------------------------------------------------------------------------ */}
                            <Redirect exact from='*' to='/404' />
                        </Switch>
                        <Footer />
                    </React.Fragment>
                )}
            </Suspense>
        </ReactRouter>
    )
}

const mapStateToProps = (state) => ({
    routes: state.routes,
    fetchingRoutes: state.routes.loading,
})

export default connect(mapStateToProps)(Routes);