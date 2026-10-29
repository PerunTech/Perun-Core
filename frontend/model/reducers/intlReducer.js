// The labels and locale react-intl renders with, as react-intl-redux kept them: the same action
// type and the same state shape, so a persisted `intl` rehydrates as before and modules that read
// `state.intl.messages` or `state.intl.locale` from the store see no change.
export const UPDATE_INTL = '@@intl/UPDATE'

export function updateIntl({ locale, formats, messages }) {
  return { type: UPDATE_INTL, payload: { locale, formats, messages } }
}

export function intlReducer(state = { locale: 'en', messages: {} }, action) {
  if (action.type !== UPDATE_INTL) {
    return state
  }
  return { ...state, ...action.payload }
}
