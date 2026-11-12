import axios from 'axios'
import { getCookie, setCookie } from './cookies'

// The old defaultLocale cookie is only a fallback where DEFAULT_LOCALE isn't set, and nothing writes
// it: the assets' js/locale.js rewrites it on every page load and races this bundle.

let current = ''
let initial

export const currentLanguage = () => current

export const setCurrentLanguage = (language) => {
  current = language
}

export const keepLanguage = (language) => {
  setCookie('selectedLocale', language)
}

// DEFAULT_LOCALE is asked for only when there is no pick, and once per page load.
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
