import axios from 'axios'
import { store, addConfiguration } from '../model'
import * as config from '../config/config'
import constants from './constants.json'
import { alertUserResponse } from '../elements'
/**
 * Get configuration dispatch function- gets the requested configuration from the DB.
 * After the request has been fulfilled a reducing function writes the configuration in the global application state.
 * The wrapper then returns the retreived configuration to the wrapped component.
 * @version 1.0
 * @function
 */

export function loadConfiguration(componentName, configPath) {
  /**
   * MANDATORY PARAMETERS
   * @param {string} componentName - Type of configuration required by the web service
   * @param {string} configPath - Class path to get component configuration
   */

  const session = store.getState().security.svSession
  let verbPath
  if (configPath) {
    verbPath = configPath
  } else {
    verbPath = config.svConfig.triglavRestVerbs[constants.getConfigurationServiceName]
    verbPath = verbPath.replace(`%${constants.componentNameParameter}`, componentName)
    verbPath = verbPath.replace(`%${constants.session}`, session)
  }
  const restUrl = config.svConfig.restSvcBaseUrl + verbPath
  axios.get(restUrl).then((response) => {
    store.dispatch(addConfiguration(response.data, componentName))
  }).catch(err => {
    console.error(err)
    alertUserResponse({ response: err })
  });
}
