import * as registry from './Router';

/**
 * Remote script utilities.
 *
 * The registry and the loader live in Router.js, which loads the bundles stored from the last
 * session at boot. Going through the same ones here is what keeps ModuleMenu from running a
 * bundle a second time after the boot has already run it.
 *
 * @namespace pluginManager
 */
export const pluginManager = {
  /**
   * Retrieves the whole plugin registry.
   * The caller can decide what to do with it.
   *
   * &nbsp;
   *
   * @function getRegistry (getRegistry): any
   *
   * @returns The map of registered plugins.
   */
  getRegistry() {
    return registry.loadedPlugins;
  },

  /**
   * Retrives a plugin from the registry with the given `name`.
   *
   * &nbsp;
   *
   * @function getPlugin (name: string): any || Error
   *
   * @param {string} name - The name of the plugin.
   *
   * @returns any || Error;
   */
  getPlugin(name) {
    return registry.loadedPlugins[name]
      || Reflect.construct(Error, [`Plugin with reference key: ${name} has not been found.`]);
  },

  /**
   * Registers a `plugin` in the registry with the given `name`.
   * Will overwrite the register under `name`, `use with caution`.
   *
   * &nbsp;
   *
   * @function registerPlugin (name:string, plugin: any): plugin || Error
   *
   * @param {string} name - The name of the plugin.
   * @param {*} plugin - The plugin entity.
   *
   * @returns plugin || Error;
   */
  registerPlugin(name, plugin) {
    return (name && plugin)
      ? registry.registerPlugin(name, plugin)
      : Reflect.construct(Error, ['Plugin failed to register. Invalid arguments provided.']);
  },

  /**
   * Loads and executes a plugin (as script) in the current browser environment.
   *
   * Responsibility deferred to caller to provide full path and name,
   * omitted any path resolution for an url, given a name string reference.
   *
   *
   * No solution provided for webpack-specific bundles, loader is old school, executes scripts from url.
   * `The plugin should register itself in the global context on script execution, i.e the entry point
   * of the plugin should assemble all exposable modules such that plugin = {...modules}
   * and do window[name] = plugin`.
   *
   * The loader will simply look on the global context for the given `name` in the arguments.
   * If the plugin is already registered, the script will not be executed again and the promise
   * resolves with the registered plugin. A load already in flight is shared, not repeated.
   *
   * &nbsp
   *
   * @function loadPlugin (name: string, url: string): Promise <any>
   *
   * @param {string} name - Name of the plugin.
   * @param {string} url - URL path of the script.
   *
   * @returns Promise <any>;
   */
  loadPlugin(name, url) {
    return registry.loadPlugin(name, url);
  },
};
