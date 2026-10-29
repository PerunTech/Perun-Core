import axios from 'axios'
import { getCookie, setCookie } from './cookies'

/**
 * The app's language, named as the labels are (`en_US`).
 *
 * Two settings decide it. The user's pick is kept in this browser, in the `selectedLocale` cookie: it is
 * made on the login page, before anyone has signed in. Until there is one, the app starts in the
 * deployment's default, the DEFAULT_LOCALE system parameter.
 *
 * Both used to share the `defaultLocale` cookie, which the assets project's js/locale.js writes on every
 * page load. That script and this bundle race, and when locale.js ran first, as it does on a hard
 * refresh, the pick was overwritten and the app came back up in the default. The cookie is still read
 * where DEFAULT_LOCALE is not set, until every deployment has the parameter; nothing here writes it.
 */

let current = ''
let initial

/** The language the app is in, or is loading; '' before the first labels are asked for. */
export const currentLanguage = () => current

/** Records the language whose labels the app is loading. */
export const setCurrentLanguage = (language) => {
  current = language
}

/** Keeps the language the user picked for the next page load. */
export const keepLanguage = (language) => {
  setCookie('selectedLocale', language)
}

/**
 * The language the app starts in: the user's pick, else DEFAULT_LOCALE, else English. DEFAULT_LOCALE
 * is only asked for when there is no pick, and once per page load.
 */
export function initialLanguage() {
  if (!initial) {
    initial = Promise.resolve(getCookie('selectedLocale') || defaultLanguage())
  }
  return initial
}

function defaultLanguage() {
  return axios.get(`${window.server}/WsConf/params/get/sys/DEFAULT_LOCALE`)
    .then(res => res?.data?.VALUE)
    .catch(() => undefined)
    .then(value => value || getCookie('defaultLocale') || 'en_US')
}
