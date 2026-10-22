// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { get } }))

const clear = (...names) => names.forEach(name => { document.cookie = `${name}=; max-age=0` })

// The module keeps the language it started in for the life of the page, so each test loads it anew.
const load = () => import('../../frontend/functions/language')

describe('language', () => {
  beforeEach(() => {
    vi.resetModules()
    window.server = 'http://backend'
  })

  afterEach(() => {
    get.mockReset()
    clear('selectedLocale', 'defaultLocale')
  })

  it("starts in the user's pick without asking the server", async () => {
    document.cookie = 'selectedLocale=mk_MK'
    const { initialLanguage } = await load()
    expect(await initialLanguage()).toBe('mk_MK')
    expect(get).not.toHaveBeenCalled()
  })

  it('starts in DEFAULT_LOCALE when there is no pick, over the old defaultLocale cookie', async () => {
    document.cookie = 'defaultLocale=sq_AL'
    get.mockResolvedValue({ data: { VALUE: 'ka_GE' } })
    const { initialLanguage } = await load()
    expect(await initialLanguage()).toBe('ka_GE')
    expect(get).toHaveBeenCalledWith('http://backend/WsConf/params/get/sys/DEFAULT_LOCALE')
  })

  it('falls back on the defaultLocale cookie, then English', async () => {
    get.mockResolvedValue({ data: {} })
    document.cookie = 'defaultLocale=sq_AL'
    expect(await (await load()).initialLanguage()).toBe('sq_AL')

    vi.resetModules()
    clear('defaultLocale')
    expect(await (await load()).initialLanguage()).toBe('en_US')
  })

  it('falls back when the request fails or the interceptor resolved it empty', async () => {
    get.mockRejectedValue(new Error('Network Error'))
    expect(await (await load()).initialLanguage()).toBe('en_US')

    vi.resetModules()
    get.mockResolvedValue(undefined)
    expect(await (await load()).initialLanguage()).toBe('en_US')
  })

  it('asks the server once per page load', async () => {
    get.mockResolvedValue({ data: { VALUE: 'ka_GE' } })
    const { initialLanguage } = await load()
    expect(initialLanguage()).toBe(initialLanguage())
    await initialLanguage()
    expect(get).toHaveBeenCalledOnce()
  })

  it('keeps the pick in selectedLocale, and leaves defaultLocale to the assets script', async () => {
    document.cookie = 'defaultLocale=sq_AL'
    const { keepLanguage } = await load()
    keepLanguage('mk_MK')
    expect(document.cookie).toContain('selectedLocale=mk_MK')
    expect(document.cookie).toContain('defaultLocale=sq_AL')
  })

  it('tracks the language being shown', async () => {
    const { currentLanguage, setCurrentLanguage } = await load()
    expect(currentLanguage()).toBe('')
    setCurrentLanguage('mk_MK')
    expect(currentLanguage()).toBe('mk_MK')
  })
})
