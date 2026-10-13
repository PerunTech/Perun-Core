/* base imports */
import { configureStore as configureToolkitStore } from '@reduxjs/toolkit';
/* middleware */
import promise from 'redux-promise-middleware';
import { createLogger as logger } from 'redux-logger';
import magicAsyncMiddleware from 'redux-magic-async-middleware';
/* plugins */
import { autoRehydrate } from 'redux-persist';
/* base implementation */
import createReducers from './createReducers';
import { svConfig } from '../config';

export function configureStore() {
  const store = configureToolkitStore({
    reducer: createReducers(),
    // The middleware in the order applyMiddleware had it: magic-async, promise, thunk, then the
    // logger when debugging. Toolkit's default list supplies thunk (redux-thunk 3) and, in the
    // development build only, its immutability and serializability checks. Those two are off.
    // The first throws on the first grid: GenericGrid's UNSAFE_componentWillReceiveProps sets
    // `editor` and `formatter` on the column objects of the gridConfig it was given, which are
    // the store's. The second logs on most dispatches: `routes` holds React elements, and
    // components put their handlers and `dispatch` into their slices. Both need fixing before
    // reducers move to createSlice, whose Immer freezes the state it returns.
    middleware: (getDefaultMiddleware) => {
      const middleware = getDefaultMiddleware({ immutableCheck: false, serializableCheck: false })
        .prepend(magicAsyncMiddleware, promise)
      return svConfig.isDebug ? middleware.concat(logger()) : middleware
    },
    // autoRehydrate outermost, as it was. Toolkit's defaults are the middleware and autoBatch,
    // which delays notifying subscribers only for actions marked for it (RTK Query's), so none
    // of ours.
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers().prepend(autoRehydrate()),
    devTools: process.env.MODE !== 'production'
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