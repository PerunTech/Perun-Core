import React from 'react';
import { Route } from 'react-router-dom';
import { store } from '../model';
import { getServerOrigin } from '../functions/utils';
import { sortBundlesByDependencies } from './bundleOrder';
import * as localRoutes from '.';

// The one record of loaded bundles, which ModuleMenu reaches through pluginManager, so no bundle runs
// twice. Here, not in PluginManager.js: client.js reaches PluginManager first, and this evaluates inside it.
export const loadedPlugins = {};
// Loads in flight, so a second caller waits on the first one's script instead of adding another.
const loadingPlugins = {};

const resolveScriptUrl = (url) => {
    if (!url) {
        return url;
    }
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    const normalizedPath = url.startsWith('/') ? url : `/${url}`;
    return `${getServerOrigin()}${normalizedPath}`;
};
// Rejects with { id, value: Error }: ModuleMenu reads the id to skip the plugin's dependents.
export function loadPlugin(name, url) {
    if (loadedPlugins[name]) {
        return Promise.resolve({ id: name, value: loadedPlugins[name] });
    }

    if (loadingPlugins[name]) {
        return loadingPlugins[name];
    }

    loadingPlugins[name] = new Promise((resolve, reject) => {
        const fail = error => reject({ id: name, value: error });
        const register = () => {
            const plugin = window[name]?.[name] || window[name];
            if (!plugin) {
                fail(new Error(`Plugin ${name} failed to register.`));
                return;
            }
            // A route with a bad config throws here. Thrown inside onload, that would leave this
            // load pending forever, and waitForPlugins and the first render along with it.
            try {
                resolve({ id: name, value: registerPlugin(name, plugin) });
            } catch (error) {
                fail(error);
            }
        };

        // One still on the page ran without registering (a failed fetch is removed below) and its load
        // event has passed, so take what it left or fail. Scripts only: ModuleMenu's cards share the id.
        if ([...document.scripts].some(script => script.id === name)) {
            register();
            return;
        }

        const script = Object.assign(document.createElement('script'), { id: name, type: 'text/javascript' });
        script.onload = register;
        script.onerror = () => {
            script.remove();
            fail(new Error(`Script failed to load for plugin ${name}.`));
        };
        script.src = resolveScriptUrl(url);
        document.body.appendChild(script);
    }).finally(() => {
        delete loadingPlugins[name];
    });

    return loadingPlugins[name];
}

function reInitPlugins(bundles) {
    store.dispatch({ type: 'fetchingRoutes', payload: true });

    // One at a time, in dependency order: an added script runs as soon as it arrives, so starting
    // them all at once can run a plugin before the one it depends on.
    const loadInOrder = async () => {
        for (const bundle of sortBundlesByDependencies(bundles)) {
            if (bundle.id === 'perun-core' || bundle.id === 'naits') {
                continue;
            }

            try {
                await loadPlugin(bundle.id, '/' + bundle.id + '/' + bundle.js);
            } catch (error) {
                console.error(`Error loading plugin ${bundle.id}:`, error.value || error);
            }
        }
    };

    return loadInOrder()
        .catch((error) => {
            console.error('Error loading plugins:', error);
        })
        .finally(() => {
            store.dispatch({ type: 'fetchingRoutes', payload: false });
        });
}

// A plugin without routes (spatial) is recorded too, so it isn't loaded again.
export function registerPlugin(name, plugin) {
    if (plugin.routes) {
        [...plugin.routes].forEach(route => router.registerRoute(route.name, route));
    }
    plugin.id = name;
    loadedPlugins[name] = plugin;
    return plugin;
}

const _registry = {};

export const router = (function () {
    const createRoute = (name, config) => {
        const { path, render, isExact } = config;

        if (path === undefined || render === undefined || isExact === undefined) {
            throw new Error(`Route with name: ${name} has invalid configuration.
                Failed to create a valid Route component. Please make sure that the configuration object specifies
                the following attributes: path, render, isExact.`);
        }
        const Component = render;
        return <Route exact={isExact} path={path} key={name} render={props => <Component {...props} />} />;
    };

    const registerRoute = (name, routeConfig) => {
        setRoute(name, createRoute(name, routeConfig));
    };

    const setRoute = (name, route) => {
        _registry[name] = route;
        store.dispatch({ type: 'refreshRoutes', value: _registry });
    };

    Object.entries(localRoutes).forEach(([name, config]) => {
        registerRoute(name, config);
    });

    // Which plugin registered each path, read back from the loaded bundles. The guides admin names a
    // route's module from it, since a module may serve a path spelled after another (/main/stock).
    const routeOwners = () => {
        const owners = {};
        Object.entries(loadedPlugins).forEach(([name, plugin]) => {
            if (!Array.isArray(plugin?.routes)) return;
            plugin.routes.forEach(route => {
                [route?.path].flat().filter(Boolean).forEach(path => { owners[path] = name; });
            });
        });
        return owners;
    };

    return {
        registerRoute,
        setRoute,
        routeOwners,
        waitForPlugins: () => pluginsReadyPromise,
    };
})();

// Started only once `router` is assigned: registering a plugin's routes goes through it.
const pluginsReadyPromise = reInitPlugins(JSON.parse(localStorage.getItem('bundleStorage')) || []);
