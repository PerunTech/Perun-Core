// react-intl-redux's action type and state shape, so a persisted intl rehydrates and modules reading
// state.intl see no change.
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
