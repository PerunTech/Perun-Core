import React from 'react';
import { Route } from 'react-router-dom';
import { store } from '../model';
import { getServerOrigin } from '../functions/utils';
import * as localRoutes from '.';

/**
 * Every plugin bundle that has run on this page, keyed by name, with or without routes.
 *
 * This is the one record of loaded bundles: the boot below and ModuleMenu (through pluginManager)
 * both load through `loadPlugin`, so neither runs a bundle the other already has. With a registry
 * each, every bundle ran twice, and the second spatial.js replaced window.L under the map the
 * first one had built.
 *
 * It lives here rather than in PluginManager.js because of evaluation order: client.js reaches
 * PluginManager (elements > ComponentsIndex > ModuleMenu) before it imports this file, so this
 * module evaluates inside PluginManager's import and cannot read pluginManager back at boot.
 */
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
/**
 * Loads a plugin by dynamically creating a script element, at most once per page.
 * @param {string} name - The name of the plugin.
 * @param {string} url - The URL to load the plugin from.
 * @returns {Promise} - Resolves with `{ id, value }` once the plugin is registered. Rejects with
 * `{ id, value: Error }`, the shape ModuleMenu reads a failed plugin's id from to skip its dependents.
 */
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

        // Scripts only: ModuleMenu's access cards carry the plugin name as their id as well.
        // One still on the page ran and did not register (a failed fetch is removed below), so
        // take what it left or fail; its load event has passed and waiting for it would hang.
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

/**
 * Initializes and loads plugins based on the provided bundles.
 * Ensures plugins are loaded in the correct order according to their dependencies.
 * @param {Array} bundles - The list of plugin bundles to load.
 */
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

/**
 * Sorts bundles by their dependencies to ensure correct loading order.
 * @param {Array} bundles - The list of plugin bundles to sort.
 * @returns {Array} - The sorted list of bundles.
 */
function sortBundlesByDependencies(bundles) {
    const bundleMap = new Map();
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    bundles.forEach(bundle => {
        bundleMap.set(bundle.id, bundle);
    });

    /**
     * Recursively visits each bundle and its dependencies.
     * @param {Object} bundle - The bundle to visit.
     */
    const visit = (bundle) => {
        if (!bundle || visited.has(bundle.id)) return;
        if (visiting.has(bundle.id)) throw new Error(`Circular dependency detected: ${bundle.id}`);

        visiting.add(bundle.id);

        const dependencies = JSON.parse(bundle.deps || '[]');
        dependencies.forEach(dep => visit(bundleMap.get(dep)));

        visiting.delete(bundle.id);
        visited.add(bundle.id);
        sorted.push(bundle);
    };

    bundles.forEach(bundle => visit(bundle));

    return sorted;
}

/**
 * Registers routes for the given plugin, if it has any, and records it as loaded.
 * A plugin without routes (spatial) is recorded all the same, so it is not loaded again.
 * Overwrites the record under `name`.
 * @param {string} name - The name of the plugin.
 * @param {Object} plugin - The plugin object.
 * @returns {Object} - The registered plugin.
 */
export function registerPlugin(name, plugin) {
    if (plugin.routes) {
        [...plugin.routes].forEach(route => router.registerRoute(route.name, route));
    }
    plugin.id = name;
    loadedPlugins[name] = plugin;
    return plugin;
}

/**
 * The Application routes registry.
 */
const _registry = {};

export const router = (function () {
    /**
     * Creates a Route component based on the provided configuration.
     * @param {string} name - The name of the route.
     * @param {Object} config - The route configuration object.
     * @returns {JSX.Element} - The Route component.
     */
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

    /**
     * Registers a route and updates the route registry.
     * @param {string} name - The name of the route.
     * @param {Object} routeConfig - The route configuration object.
     */
    const registerRoute = (name, routeConfig) => {
        setRoute(name, createRoute(name, routeConfig));
    };

    /**
     * Sets a route in the registry and dispatches an action to refresh routes.
     * @param {string} name - The name of the route.
     * @param {JSX.Element} route - The Route component.
     */
    const setRoute = (name, route) => {
        _registry[name] = route;
        store.dispatch({ type: 'refreshRoutes', value: _registry });
    };

    Object.entries(localRoutes).forEach(([name, config]) => {
        registerRoute(name, config);
    });

    /**
     * Which plugin registered each route, keyed by path.
     *
     * The registry above is keyed by route name and holds rendered <Route> elements, so the plugin
     * a route came from is otherwise lost the moment it is registered. Read back out of the loaded
     * bundles rather than recorded during registration, so this stays a read of state that already
     * exists. A plugin may declare a path as an array, which is flattened here.
     *
     * Used by the user guides admin to name the module a route belongs to, which is not always the
     * module its path is spelled after: farm-registry also serves /main/registry.
     */
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
