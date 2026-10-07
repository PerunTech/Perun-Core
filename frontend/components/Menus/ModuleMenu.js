import { name as packageName } from '../../../package.json';
import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { connect } from 'react-redux'
import { Loading } from '../ComponentsIndex';
import { store } from '../../model';
import { pluginManager } from '../../routes/PluginManager';
import { alertUserResponse } from '../../elements';
import { svConfig } from '../../config';
import { getServerOrigin } from '../../functions/utils';

let arrayOfBundles
class ModuleMenu extends React.Component {
  constructor(props) {
    super(props)
    this.state = { cards: {}, loading: false, hasCardForDirectAccess: false }// is Object of pluginName: pluginCard properties.
    // backend location
    this.server = getServerOrigin();

    // Internal map of the registered plugins. Create reference at beginning of call. 
    // Mutable, pluginManager is responsible. Do not put into state.
    this.registry = pluginManager.getRegistry();
    // self id
    this.self = packageName;
    this.setLegacyNaits = this.setLegacyNaits.bind(this)
  }

  componentDidMount() {
    this.transformIdScreen()
    this.getConfigCards()
  }

  transformIdScreen = () => {
    const idScreen = document.getElementById('identificationScreen')
    if (idScreen) {
      idScreen.innerText = this.context.intl.formatMessage({
        id: 'perun.main_menu', defaultMessage: 'perun.main_menu'
      })
    }
  }

  getConfigCards = () => {
    this.loadModuleCardsConfig().then(res => {
      if (res?.data?.data) {
        const data = res.data
        store.dispatch({ type: 'GET_MODULE_LINKS', payload: { data } })
        localStorage.setItem('bundleStorage', JSON.stringify(data.data));
        for (let i = 0; i < data.data.length; i++) {
          if (data.data[i]?.id === 'perun-core') {
            store.dispatch({ type: 'accessAdminConsole', payload: true });
          }
          const plugin = data.data[i]
          // Check if the plugin should be directly accessed
          if (plugin.cardDirectAccess) {
            // Break out of the loop and prepare the plugin (and its dependencies) for the direct access
            this.setState({ loading: true, hasCardForDirectAccess: true }, () => this.preparePluginsForDirectAccess(plugin, data.data))
            break;
          } else {
            // If the loop is finished, continue loading all available plugins
            if (i === data.data.length - 1) {
              let i = 0;
              arrayOfBundles = data.data
              arrayOfBundles.map(item => {
                if (item.hasPersistReducer) {
                  i++
                  localStorage.setItem('indexReducers', i);
                }
              })
              this.loadPlugins(data.data);
            }
          }
        }
      }
    }).catch((err) => {
      console.error(err)
      alertUserResponse({ response: err })
    })
  }

  /**
   * Resolve plugin cards configuration source in this order:
   * 1) localStorage payload override (`perun.pluginCardsPayload`)
   * 2) local URL override (`window.localPluginCardsUrl` or `localStorage.perun.pluginCardsUrl`)
   * 3) default backend endpoint
   */
  loadModuleCardsConfig = () => {
    const localPayload = localStorage.getItem('perun.pluginCardsPayload');
    if (localPayload) {
      try {
        const parsed = JSON.parse(localPayload);
        const payloadData = Array.isArray(parsed) ? parsed : parsed?.data;
        if (Array.isArray(payloadData)) {
          return Promise.resolve({
            data: {
              type: 'SUCCESS',
              title: 'Loaded plugins from localStorage',
              message: 'Loaded plugins from localStorage',
              label_code: null,
              data: payloadData
            }
          });
        }
      } catch (e) {
        console.error('Invalid local plugin payload in localStorage key perun.pluginCardsPayload', e);
      }
    }

    const localUrl = window.localPluginCardsUrl || localStorage.getItem('perun.pluginCardsUrl');
    if (localUrl) {
      return axios.get(localUrl);
    }

    const url = `${svConfig.restSvcBaseUrl}${svConfig.triglavRestVerbs.GET_CONFIGURATION_MODULE_DB}${this.props.svSession}`;
    return axios.get(url);
  }

  /**
   * Load the appropriate plugins needed for the direct access transition.
   * 
   * @param {Array} data - All plugins needed for the direct access transition.
   * 
   * @return void
   */
  loadPluginsForDirectAccess = (data) => {
    // Preserve data argument in call. Clone config and exclude cached entries. This is our work config array.
    let config = this.initConfig(data);
    // Generate iterable of promises, include plugins with zero dependencies only.
    let plugins = this.initPlugins(config);
    // If there are no pending promises, exit, otherwise execute.
    if (plugins.length > 0) {
      this.atomiclyExecute(plugins)
        .then(resolutions => {
          // Prep input for next cycle.
          // Process this cycle resolutions based on status. Update next cycle for failed plugins.
          let next = this.resolvePlugins(
            config,
            resolutions,
            this.recalcExecutables(data, resolutions));

          // call self with recalculated executables and go for another round, if pending scripts are found.
          next.length > 0 && this.loadPlugins(next)
          next.length === 0 && this.setState({ loading: false })
        })
        .catch(err => {
          console.log(err)
          this.setState({ loading: false, hasCardForDirectAccess: false })
          localStorage.setItem('hasError', true)
        })
    }
  }

  /**
   * Recursively find all dependencies for any list of plugins
   * 
   * @param {Array} plugins - All available plugins for the user.
   * @param {Array} dependencies - All the dependencies for the plugin that needs to be directly accessed.
   * 
   * @return any[]
   */
  depsFinder = (plugins, dependencies) => {
    const depsArr = [];
    plugins.forEach(item => {
      if (dependencies.includes(item.id)) {
        depsArr.unshift(item);
        if (item.deps && item.deps.length > 0) {
          const parsedDeps = JSON.parse(item.deps);
          depsArr.unshift(...this.depsFinder(plugins, parsedDeps));
        }
      }
    });
    return depsArr;
  }

  /**
   * Prepare the appropriate plugins needed for the direct access transition.
   * Get both the plugin that needs to be directly accessed and its dependencies (along with their dependencies)
   * 
   * @param {Object} directAccessPlugin - The plugin that needs to be directly accessed.
   * @param {Array} plugins - All available plugins for the user.
   * 
   * @return void
   */
  preparePluginsForDirectAccess = (directAccessPlugin, plugins) => {
    // Find the plugin's dependencies
    const deps = this.filterDeps(directAccessPlugin).deps;
    let depsObjects = []
    // If there are any dependencies, get their full plugin data from the array of available plugins
    if (deps.length > 0) {
      depsObjects = this.depsFinder(plugins, deps);
    }
    depsObjects.push(directAccessPlugin)
    this.loadPluginsForDirectAccess(depsObjects);
  }

  /**
   * Assemble configuration of plugins to be loaded by script execution.
   * Provide access cards immediately for already registered plugins which have registered routes.
   * 
   * @param {*} data - The input configuration.
   * 
   * @return modified / processed configuration, made ready for script execution.
   */
  initConfig = data => {
    return data.reduce(function (config, plugin) {
      (this.registry[plugin.id] === undefined && plugin.id !== this.self)
        ? config.push(this.filterDeps(plugin))
        : this.setAccessCard(plugin);

      return config;
    }.bind(this), []);
  }

  /**
   * Generate iterable of promises for each plugin to be executed as a script.
   * Include plugins with zero dependencies only.
   * 
   * @param {JSON} config 
   * 
   * @return [...Promises]
   */
  initPlugins = config => {
    return config.reduce(function (plugins, plugin) {
      plugin.deps.length < 1
        && plugins.push(pluginManager.loadPlugin(plugin.id, '/' + plugin.id + '/' + plugin.js));
      // this.server+'/'+plugin.id+'/'+plugin.js));

      return plugins;
    }.bind(this), []);
  }

  /**
   * Templater for our final module access cards. Works on an individual plugin.
   * Updates state by cloning the current cards object and appending the generated card.
   * 
   * The logic in this method can be moved to a separate view class (<AccessCard>).  
   * 
   * @param {*} plugin - The plugin to be generated access for.
   * 
   * @return void;
   */
  setAccessCard = plugin => {
    /* check if fr route and plugin is present */
    if (window.core.memorizeFrMapRoute && plugin.id === 'farm-registry') {
      this.goDirectToFrMapRoute(window.core.memorizeFrMapRoute)
    }

    // check for direct access flag and re-route
    if (plugin.cardDirectAccess) {
      this.goDirectToRoute(plugin);
    } else {
      // state setter utility, so we can actually read the bottom part of the code.
      const render = (id, card) =>
        this.setState({ cards: { ...this.state.cards, [id]: card } });

      // Check, for a given plugin id, if the plugin is registered with our manager along with a valid route.
      const isRoutable = id =>
        this.registry[id] && this.registry[id].routes && this.registry[id].routes.length > 0;

      // JSX template for our access cards.
      let accessCard = <Link to={'/main/' + plugin.id}
        id={plugin.id}
        className='moduleCard'
        key={plugin.id}
      >
        <div className='box'>
          <div className='cardImgTop'>
            <img src={this.server + plugin.imgPath} />
          </div>
          <div title={plugin.text} className='cardBody' >
            <h5 className='card-title'>{plugin.title}</h5>
          </div>
        </div>
      </Link>;

      plugin.id === this.self
        ? render(plugin.id, accessCard)
        : isRoutable(plugin.id) && !plugin.cardHidden && render(plugin.id, accessCard);
    }
  }

  /* function that provides re-routing to requested module
   * provided to exclude main card menu
   * 
   * @param {*} plugin - The plugin to be re-routed to.
   * 
   * @return void;
   */
  goDirectToRoute = plugin => {
    let url = window.location.href
    let arr = url.split("/");
    let currentUrl = arr[0] + "//" + arr[2]
    let finalUrl = currentUrl + `/perun/index.html#/main/${plugin.id}`
    // If we're working locally, do the redirect without the /perun/index.html part
    if (url.includes('localhost'))
      finalUrl = currentUrl + `#/main/${plugin.id}`

    // tmp transition for old naits module 
    if (plugin.id === 'naits')
      finalUrl = currentUrl + '/naits/index.html'

    return location.replace(finalUrl);
  }

  /* function that redirects the user directly to the FR Map bundle */
  goDirectToFrMapRoute = (route) => {
    window.core.memorizeFrMapRoute = ''
    return location.replace(route)
  }

  /**
   * Transforms plugin dependency field, excludes already registered plugins.
   * 
   * Internal implementation assumes that once a plugin does not require any dependencies in its field,
   * its script can be loaded / executed. This concept provides the elementary progression
   * of executable scripts through cycles.
   * 
   * @param {JSON} plugin
   * 
   * @return The plugin configuration, with a transformed dependency property.
   */
  filterDeps = plugin => {
    let deps = (typeof plugin.deps === 'string' || plugin.deps instanceof String)
      ? JSON.parse(plugin.deps)
      : (plugin.deps || []); // assign default value, if backend somehow failed in configuration assembly.

    // filter the deps array, exclude all registered plugins as well as core if someone decided to list it.
    plugin.deps = deps.filter(dep => this.registry[dep] === undefined && dep !== this.self);

    return plugin;
  }

  /**
   * Complete resolution for multiple independent async processes.
   * Fire multiple promises and resolve only when all of them succeed or fail.
   * 
   * The gimmick is that Promise.all exits on the first failed promise, i.e. it is used for dependent operations.
   * Hence this utility. This is a polyfill for Promise.allSettled, still in ECMA proposal stage.
   * 
   * @param {iterable} promises
   * 
   * @return [...resolutions]; 
   */
  atomiclyExecute = promises => {
    let wrappedPromises = promises.map(p => Promise.resolve(p)
      .then(
        ({ id, value }) => ({ status: 1, id: id, value: value }), // status > 0 is fulfilled.
        ({ id, value }) => ({ status: -1, id: id, value: value }))); // status < 0 is rejected.

    return Promise.all(wrappedPromises);
  }

  /**
   * Generates a new array which contains all elements from our initial script configuration (data)
   * that are not contained in our resolved resolutions array,
   * i.e. exclude executed scripts from config and prepare next scripts to be loaded.
   * 
   * @param {JSON} data 
   * @param {Array} resolutions 
   * 
   * @returns [data - resolutions];
   */
  recalcExecutables = (data, resolutions) => {
    return data.filter(plugin =>
      !(resolutions.map(r => r.id).includes(plugin.id)));
  }

  /**
   * Resolves executed plugins base on status, fulfilled > 0 and rejected < 0.
   * 
   * Render access cards for successful loadings.
   * Filter for failed executions, remove all next entries that depend on the failed plugin, 
   * i.e. If B depends on A and A fails, then B fails as a consequence and should not be executed, obviously.
   * 
   * Outputs pending plugin scripts to be executed in the next cycle.
   * 
   * @param {JSON} config 
   * @param {Array} resolutions 
   * @param {Array} next 
   * 
   * @return {Array} next, input config for next cycle.  
   */
  resolvePlugins = (config, resolutions, next) => {
    resolutions.map(res =>
      res.status > 0
        ? this.setAccessCard(config.find(plugin => plugin.id === res.id))
        : next = next.filter(plugin => !(plugin.deps?.includes(res.id))));

    return next;
  }

  /**
   * Program entry for loading external plugins via script execution.
   * 
   * Solves for:
   *  - plugin dependencies and execution order via pseudo topological sort,
   *  - script caching,
   *  - async processes resolution,
   *  - UI access to modules.
   * 
   * Input is backend configuration assembled from registered iPlugin implemetations
   * and output is access cards which route to the registered plugin module.
   * 
   * @param {JSON} data - The configuration array.
   * 
   * @return JSX, the class content cards;
   */
  loadPlugins = data => {
    let naitsPlugin = data.filter(el => el.id === 'naits')[0]
    if (naitsPlugin) {
      if (naitsPlugin.cardDirectAccess) {
        this.goDirectToRoute(naitsPlugin);
      }
      this.setLegacyNaits(naitsPlugin);
      const index = data.findIndex(x => x.id === "naits");
      if (index !== undefined) data.splice(index, 1);
    }
    // Preserve data argument in call. Clone config and exclude cached entries. This is our work config array.
    let config = this.initConfig(data);
    // Generate iterable of promises, include plugins with zero dependencies only.
    let plugins = this.initPlugins(config);
    // If there are no pending promises, exit, otherwise execute.
    if (plugins.length > 0) {
      this.atomiclyExecute(plugins)
        .then(resolutions => {
          // Prep input for next cycle.
          // Process this cycle resolutions based on status. Update next cycle for failed plugins.
          let next = this.resolvePlugins(
            config,
            resolutions,
            this.recalcExecutables(data, resolutions));

          // call self with recalculated executables and go for another round, if pending scripts are found.
          next.length > 0 && this.loadPlugins(next)
        })
        .catch(err => {
          console.log(err)
          localStorage.setItem('hasError', true)
        })
    }
  }
  setLegacyNaits(plugin) {
    return plugin && this.setState({
      cards: {
        ...this.state.cards, [plugin.id]: <a
          id={plugin.id}
          className='moduleCard'
          key={plugin.id}
          onClick={() => {
            let url = window.location.href
            let arr = url.split("/");
            let currentUrl = arr[0] + "//" + arr[2]
            location.replace(currentUrl + '/naits/index.html');
          }} >
          <div className='box'>
            <div className='cardImgTop'>
              <img src={plugin.imgPath} />
            </div>
            <div title={plugin.text} className='cardBody' >
              <h5 className='card-title'>{plugin.title}</h5>
            </div>
          </div>
        </a>
      }
    });
  }

  render() {
    const { cards, loading, hasCardForDirectAccess } = this.state;

    return loading ? <Loading /> : (
      <div id='holderCards' className='holderCards'>
        {!hasCardForDirectAccess ? <div id='mainGrid' className={'mainGrid'}>{Object.values(cards)}</div> : <></>}
      </div>
    )
  }
}

ModuleMenu.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  svSession: state.security.svSession,
  storeState: state
})

export default connect(mapStateToProps)(ModuleMenu);
