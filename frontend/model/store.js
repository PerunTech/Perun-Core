import { configureStore as configureToolkitStore } from '@reduxjs/toolkit';
import { autoRehydrate } from './persist';
import createReducers from './createReducers';
import { svConfig } from '../config';

export function configureStore() {
  const store = configureToolkitStore({
    reducer: createReducers(),
    // Both checks off: rowClicked writes ROW_ID into the store's row, and routes holds React elements.
    // Fix both before moving to createSlice, whose Immer freezes the state.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
    // autoRehydrate outermost.
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers().prepend(autoRehydrate()),
    // With each action's stack trace; without the extension it does nothing.
    devTools: (process.env.MODE !== 'production' || svConfig.isDebug) && { trace: true }
  })
  store.asyncReducers = {}
  return store;
}

export function injectAsyncReducer(store, name, asyncReducer) {
  store.asyncReducers[name] = asyncReducer
  store.replaceReducer(createReducers(store.asyncReducers))
}

export function removeAsyncReducer(store, name) {
  if (delete store.asyncReducers[name]) {
    const newStoreState = store.asyncReducers
    store.replaceReducer(createReducers(newStoreState))
  } else {
    console.warn('You are trying to remove a non-configurable own object property.')
  }
}

export const store = configureStore();