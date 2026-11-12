import { name as packageName } from '../../../package.json';
import React from 'react'
import { IntlContext } from 'react-intl'
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
    this.state = { cards: {}, loading: false, hasCardForDirectAccess: false }
    this.server = getServerOrigin();

    // Mutable and owned by pluginManager, so not in state.
    this.registry = pluginManager.getRegistry();
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
      idScreen.innerText = this.context.formatMessage({
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
          if (plugin.cardDirectAccess) {
            this.setState({ loading: true, hasCardForDirectAccess: true }, () => this.preparePluginsForDirectAccess(plugin, data.data))
            break;
          } else {
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

  // perun.pluginCardsPayload in localStorage, else window.localPluginCardsUrl or perun.pluginCardsUrl,
  // else the backend.
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

  loadPluginsForDirectAccess = (data) => {
    let config = this.initConfig(data);
    let plugins = this.initPlugins(config);
    if (plugins.length > 0) {
      this.atomiclyExecute(plugins)
        .then(resolutions => {
          let next = this.resolvePlugins(
            config,
            resolutions,
            this.recalcExecutables(data, resolutions));

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

  preparePluginsForDirectAccess = (directAccessPlugin, plugins) => {
    const deps = this.filterDeps(directAccessPlugin).deps;
    let depsObjects = []
    if (deps.length > 0) {
      depsObjects = this.depsFinder(plugins, deps);
    }
    depsObjects.push(directAccessPlugin)
    this.loadPluginsForDirectAccess(depsObjects);
  }

  // Plugins already registered get their cards right away and are left out of the config.
  initConfig = data => {
    return data.reduce(function (config, plugin) {
      (this.registry[plugin.id] === undefined && plugin.id !== this.self)
        ? config.push(this.filterDeps(plugin))
        : this.setAccessCard(plugin);

      return config;
    }.bind(this), []);
  }

  initPlugins = config => {
    return config.reduce(function (plugins, plugin) {
      plugin.deps.length < 1
        && plugins.push(pluginManager.loadPlugin(plugin.id, '/' + plugin.id + '/' + plugin.js));

      return plugins;
    }.bind(this), []);
  }

  setAccessCard = plugin => {
    if (plugin.cardDirectAccess) {
      this.goDirectToRoute(plugin);
    } else {
      // From the previous state: the cards are set in loops, whose setStates are batched.
      const render = (id, card) =>
        this.setState(state => ({ cards: { ...state.cards, [id]: card } }));

      const isRoutable = id =>
        this.registry[id] && this.registry[id].routes && this.registry[id].routes.length > 0;

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

  goDirectToRoute = plugin => {
    let url = window.location.href
    let arr = url.split("/");
    let currentUrl = arr[0] + "//" + arr[2]
    let finalUrl = currentUrl + `/perun/index.html#/main/${plugin.id}`
    if (url.includes('localhost'))
      finalUrl = currentUrl + `#/main/${plugin.id}`

    // tmp transition for old naits module 
    if (plugin.id === 'naits')
      finalUrl = currentUrl + '/naits/index.html'

    return location.replace(finalUrl);
  }

  // Drops the deps already registered; a plugin left with none loads in the next cycle.
  filterDeps = plugin => {
    let deps = (typeof plugin.deps === 'string' || plugin.deps instanceof String)
      ? JSON.parse(plugin.deps)
      : (plugin.deps || []);

    plugin.deps = deps.filter(dep => this.registry[dep] === undefined && dep !== this.self);

    return plugin;
  }

  // Like Promise.allSettled, with status 1 for fulfilled and -1 for rejected.
  atomiclyExecute = promises => {
    let wrappedPromises = promises.map(p => Promise.resolve(p)
      .then(
        ({ id, value }) => ({ status: 1, id: id, value: value }),
        ({ id, value }) => ({ status: -1, id: id, value: value })));

    return Promise.all(wrappedPromises);
  }

  recalcExecutables = (data, resolutions) => {
    return data.filter(plugin =>
      !(resolutions.map(r => r.id).includes(plugin.id)));
  }

  // Cards for the loaded plugins; anything that depends on a failed one is dropped from the next cycle.
  resolvePlugins = (config, resolutions, next) => {
    resolutions.map(res =>
      res.status > 0
        ? this.setAccessCard(config.find(plugin => plugin.id === res.id))
        : next = next.filter(plugin => !(plugin.deps?.includes(res.id))));

    return next;
  }

  // Loads the plugin scripts in dependency order, one cycle per level, with a card for each.
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
    let config = this.initConfig(data);
    let plugins = this.initPlugins(config);
    if (plugins.length > 0) {
      this.atomiclyExecute(plugins)
        .then(resolutions => {
          let next = this.resolvePlugins(
            config,
            resolutions,
            this.recalcExecutables(data, resolutions));

          next.length > 0 && this.loadPlugins(next)
        })
        .catch(err => {
          console.log(err)
          localStorage.setItem('hasError', true)
        })
    } else {
      config.forEach(plugin =>
        console.warn(`Skipping plugin ${plugin.id}: its dependency ${plugin.deps[0]} is not available.`))
    }
  }
  setLegacyNaits(plugin) {
    return plugin && this.setState(state => ({
      cards: {
        ...state.cards, [plugin.id]: <a
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
    }));
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

ModuleMenu.contextType = IntlContext

const mapStateToProps = state => ({
  svSession: state.security.svSession,
  storeState: state
})

export default connect(mapStateToProps)(ModuleMenu);
