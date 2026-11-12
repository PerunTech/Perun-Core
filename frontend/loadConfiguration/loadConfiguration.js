import axios from 'axios'
import { store, addConfiguration } from '../model'
import * as config from '../config/config'
import constants from './constants.json'
import { alertUserResponse } from '../elements'

export function loadConfiguration(componentName, configPath) {
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
