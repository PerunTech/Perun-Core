import * as registry from './Router';

// The registry and loader live in Router.js, so ModuleMenu doesn't rerun a bundle the boot already ran.
export const pluginManager = {
  getRegistry() {
    return registry.loadedPlugins;
  },

  getPlugin(name) {
    return registry.loadedPlugins[name]
      || Reflect.construct(Error, [`Plugin with reference key: ${name} has not been found.`]);
  },

  // Overwrites the record under name.
  registerPlugin(name, plugin) {
    return (name && plugin)
      ? registry.registerPlugin(name, plugin)
      : Reflect.construct(Error, ['Plugin failed to register. Invalid arguments provided.']);
  },

  // The plugin's script must set window[name]. A registered plugin isn't loaded again.
  loadPlugin(name, url) {
    return registry.loadPlugin(name, url);
  },
};
