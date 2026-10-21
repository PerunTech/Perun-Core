import { combineReducers } from 'redux';
import createMergeReducer from './mergeReducer';
import { intlReducer } from './reducers/intlReducer';
import gridConfig from './reducers/gridConfig';
import checkForInvalidSession from './reducers/checkForInvalidSession';
import configuratorReducer from './reducers/configuratorReducer';
import security from './reducers/logonReducer';
import globalRequestProcessor from './reducers/globalRequestProcessor';
import notificationReducer from './reducers/notificationReducer';
import contextMenuItemsReducer from './reducers/contextMenuItems'
import clickedMenuReducer from './reducers/clickedMenuReducer'
import { selectedGridRows } from './reducers/selectedGridRows';
import { historyReducer } from './reducers/historyReducer';
import { routesReducer } from './reducers/routesReducer';
import { modalReducer } from './reducers/modalReducer';
import businessLogicReducer from './reducers/businessLogicReducer'
import { userInfoReducer } from './reducers/userInfoReducer';
import moduleLinksReducer from './reducers/moduleLinksReducer';
import { admConsoleFormData } from './reducers/admConsoleFormData';
import componentIndexReducer from './reducers/componentIndexReducer';

export default function createReducers(asyncReducers) {
  const reducers = {
    gridConfig: gridConfig,
    security: security,
    intl: intlReducer,
    stateTooltip: createMergeReducer('stateTooltip', { stateTooltip: false }),
    componentIndex: componentIndexReducer,
    checkForInvalidSession: checkForInvalidSession,
    configurator: configuratorReducer,
    globalRequestProcessor: globalRequestProcessor,
    notificationReducer: notificationReducer,
    contextMenuItemsReducer: contextMenuItemsReducer,
    clickedMenuReducer: clickedMenuReducer,
    selectedGridRows: selectedGridRows,
    historyReducer: historyReducer,
    routes: routesReducer,
    modal: modalReducer,
    userInfo: userInfoReducer,
    businessLogicReducer: businessLogicReducer,
    moduleLinks: moduleLinksReducer,
    admConsoleFormData: admConsoleFormData,
    ...asyncReducers
  }
  const appReducer = combineReducers(reducers)
  const owned = (key) => Object.prototype.hasOwnProperty.call(reducers, key)

  // Drops the slices whose reducers removeAsyncReducer took out, before combineReducers sees them.
  // combineReducers drops them as well, silently on the action replaceReducer dispatches, which is
  // the only one a removed slice reaches without Redux DevTools. With it, each replaceReducer
  // replays DevTools' history through the new reducer from a state up to 50 actions old, and the
  // development build warns about every slice that state still holds.
  const rootReducer = (state, action) => {
    if (state && !Object.keys(state).every(owned)) {
      state = Object.fromEntries(Object.entries(state).filter(([key]) => owned(key)))
    }
    return appReducer(state, action)
  }
  return rootReducer
}
