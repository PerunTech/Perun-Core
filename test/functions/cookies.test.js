// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { getCookie, setCookie } from '../../frontend/functions/cookies'

const clear = (...names) => names.forEach(name => { document.cookie = `${name}=; max-age=0` })

describe('cookies', () => {
  afterEach(() => clear('selectedLocale', 'Locale', 'token', 'other'))

  it('reads back what setCookie wrote', () => {
    setCookie('selectedLocale', 'mk_MK')
    expect(getCookie('selectedLocale')).toBe('mk_MK')
  })

  it('answers an empty string for a cookie that is not there', () => {
    expect(getCookie('selectedLocale')).toBe('')
  })

  it('matches the whole name, not the end of a longer one', () => {
    setCookie('selectedLocale', 'mk_MK')
    expect(getCookie('Locale')).toBe('')
    setCookie('Locale', 'en_US')
    expect(getCookie('Locale')).toBe('en_US')
    expect(getCookie('selectedLocale')).toBe('mk_MK')
  })

  it('keeps an = inside the value', () => {
    setCookie('token', 'a=b==')
    setCookie('other', 'x')
    expect(getCookie('token')).toBe('a=b==')
  })
})
