/* base imports */
import { configureStore as configureToolkitStore } from '@reduxjs/toolkit';
/* plugins */
import { autoRehydrate } from './persist';
/* base implementation */
import createReducers from './createReducers';
import { svConfig } from '../config';

export function configureStore() {
  const store = configureToolkitStore({
    reducer: createReducers(),
    // Toolkit's default list: thunk (redux-thunk 3) and, in the development build only, its
    // immutability and serializability checks. Those two are off. The first throws on the first
    // grid: GenericGrid's UNSAFE_componentWillReceiveProps sets `editor` and `formatter` on the
    // column objects of the gridConfig it was given, which are the store's. The second logs on
    // most dispatches: `routes` holds React elements, and components put their handlers and
    // `dispatch` into their slices. Both need fixing before reducers move to createSlice, whose
    // Immer freezes the state it returns.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
    // autoRehydrate outermost, as it was. Toolkit's defaults are the middleware and autoBatch,
    // which delays notifying subscribers only for actions marked for it (RTK Query's), so none
    // of ours.
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers().prepend(autoRehydrate()),
    // Redux DevTools, in a browser with the extension, for the development build and the debug
    // ones (`build-dev`, which CI builds from dev for the SNAPSHOT jars), where redux-logger used
    // to print every action to the console. With each action's stack trace, which Toolkit turns
    // on by itself only in the development build. Without the extension it does nothing.
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