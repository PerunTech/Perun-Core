import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CORE_MODULE, clearHelpIndexCache, figureResolver, getHelpIndexVersion, guideTitle, guidesForRoute, loadGuideFigures,
  loadGuideIndex, loadHelpModules, loadImageIndex, moduleIdFromPath, ownerModuleForRoute, pickLocale, subscribeHelpIndex
} from '../../../frontend/elements/guides/routeGuides'
import { ALL_FILE_TYPES, listHelpFiles } from '../../../frontend/elements/guides/helpApi'
import { listHelpModules } from '../../../frontend/elements/guides/helpModules'

vi.mock('../../../frontend/elements/guides/helpApi', async (importOriginal) => ({ ...(await importOriginal()), listHelpFiles: vi.fn() }))
vi.mock('../../../frontend/elements/guides/helpModules', () => ({ listHelpModules: vi.fn() }))

const guide = (slug, locale, notes = {}) => ({ slug, locale, notes: { module: 'farm-registry', ...notes } })
const slugs = (records) => records.map((record) => `${record.slug}:${record.locale}`)

describe('moduleIdFromPath', () => {
  it('reads the module from a route under /main', () => {
    expect(moduleIdFromPath('/main/farm-registry')).toBe('farm-registry')
    expect(moduleIdFromPath('/main/farm-registry/holdings/42')).toBe('farm-registry')
  })

  it('is null for a path that names no module', () => {
    expect(moduleIdFromPath('/main')).toBeNull()
    expect(moduleIdFromPath('/home/login')).toBeNull()
    expect(moduleIdFromPath(undefined)).toBeNull()
  })
})

describe('ownerModuleForRoute', () => {
  const modules = [{ id: 'farm-registry' }, { id: 'lims' }]

  it("is the route's module when the caller knows it", () => {
    expect(ownerModuleForRoute('/main/lims/samples', modules)).toBe('lims')
  })

  it('falls to perun-core for an unknown module or a route of none', () => {
    expect(ownerModuleForRoute('/main/epi/outbreaks', modules)).toBe(CORE_MODULE)
    expect(ownerModuleForRoute('/main', modules)).toBe(CORE_MODULE)
    expect(ownerModuleForRoute('/main/lims', undefined)).toBe(CORE_MODULE)
  })
})

describe('pickLocale', () => {
  it('keeps one record per document, in the locale asked for over en_US', () => {
    const records = [guide('holdings', 'en_US'), guide('holdings', 'mk_MK'), guide('animals', 'en_US')]
    expect(slugs(pickLocale(records, 'mk_MK'))).toEqual(['holdings:mk_MK', 'animals:en_US'])
  })

  it('reads the locale as Redux carries it, and en_US when none is given', () => {
    const records = [guide('holdings', 'en_US'), guide('holdings', 'mk_MK')]
    expect(slugs(pickLocale(records, 'mk-MK'))).toEqual(['holdings:mk_MK'])
    expect(slugs(pickLocale(records, undefined))).toEqual(['holdings:en_US'])
  })

  it('drops a document in neither locale', () => {
    expect(pickLocale([guide('holdings', 'ka_GE')], 'mk_MK')).toEqual([])
  })

  it('tells apart documents of the same slug in two modules', () => {
    const records = [guide('search', 'en_US'), guide('search', 'en_US', { module: 'lims' })]
    expect(pickLocale(records, 'en_US')).toHaveLength(2)
  })
})

describe('guidesForRoute', () => {
  it('answers a path under the route, not one beside it', () => {
    const records = [guide('holdings', 'en_US', { route: '/main/farm-registry/holdings' })]
    expect(guidesForRoute(records, '/main/farm-registry/holdings/42', 'en_US')).toHaveLength(1)
    expect(guidesForRoute(records, '/main/farm-registry/holdings-archive', 'en_US')).toEqual([])
    expect(guidesForRoute(records, '/main/farm-registry', 'en_US')).toEqual([])
  })

  it('puts the most specific route first, then a literal before a parameter', () => {
    const records = [
      guide('module', 'en_US', { route: '/main/farm-registry' }),
      guide('any-holding', 'en_US', { route: '/main/farm-registry/holdings/:id' }),
      guide('holding-42', 'en_US', { route: '/main/farm-registry/holdings/42' }),
      guide('holdings', 'en_US', { route: '/main/farm-registry/holdings' })
    ]
    expect(guidesForRoute(records, '/main/farm-registry/holdings/42', 'en_US').map((record) => record.slug))
      .toEqual(['holding-42', 'any-holding', 'holdings', 'module'])
  })

  it('breaks a tie by order, then by title or slug', () => {
    const route = '/main/lims'
    const records = [
      guide('zeta', 'en_US', { route, order: 1, title: 'Samples' }),
      guide('beta', 'en_US', { route, order: '2', title: 'Analyses' }),
      guide('alpha', 'en_US', { route, order: '1', title: 'Analyses' }),
      guide('gamma', 'en_US', { route, order: 1 })
    ]
    expect(guidesForRoute(records, route, 'en_US').map((record) => record.slug)).toEqual(['alpha', 'gamma', 'zeta', 'beta'])
  })

  it('leaves out a guide with no route or a route that is not a path', () => {
    const records = [guide('none', 'en_US'), guide('relative', 'en_US', { route: 'main/lims' })]
    expect(guidesForRoute(records, '/main/lims', 'en_US')).toEqual([])
    expect(guidesForRoute(undefined, '/main/lims', 'en_US')).toEqual([])
  })
})

describe('guideTitle', () => {
  it("is the author's title, trimmed, else the slug in words", () => {
    expect(guideTitle({ slug: 'search', notes: { title: '  Searching holdings ' } })).toBe('Searching holdings')
    expect(guideTitle({ slug: 'searching-holdings_v2', notes: { title: '   ' } })).toBe('searching holdings v2')
    expect(guideTitle(undefined)).toBe('')
  })
})

describe('figureResolver', () => {
  it('finds a figure by the name written, or by the name it was stored under', () => {
    const resolve = figureResolver({ 'diagram.png': 'blob:1' })
    expect(resolve('diagram.png')).toBe('blob:1')
    expect(resolve('en_US_guide__diagram.png')).toBe('blob:1')
  })

  it('is null for a figure it does not have', () => {
    expect(figureResolver({})('diagram.png')).toBeNull()
    expect(figureResolver(undefined)('diagram.png')).toBeNull()
  })
})

describe('the help file index', () => {
  const file = (fileName, fileType, fileDate = '2026-10-01', objectId = 1) => ({ fileName, fileType, fileDate, objectId })
  const files = [
    file('en_US_holdings.md', 'HELP_DOC', '2026-09-01', 1),
    file('en_US_holdings.md', 'HELP_DOC', '2026-10-01', 2),
    file('en_US_manual.pdf', 'HELP_PDF'),
    file('en_US_holdings__map.png', 'HELP_IMAGE'),
    file('export.csv', 'OTHER')
  ]

  beforeEach(() => {
    clearHelpIndexCache()
    vi.mocked(listHelpFiles).mockReset().mockResolvedValue(files)
    vi.mocked(listHelpModules).mockReset().mockResolvedValue([{ id: 'farm-registry' }])
  })

  it('lists guides and manuals, newest of each name, and figures, from one listing', async () => {
    expect((await loadGuideIndex('s1', 7)).map((record) => record.objectId)).toEqual([2, 1])
    expect((await loadGuideIndex('s1', 7)).map((record) => record.fileName)).toEqual(['en_US_holdings.md', 'en_US_manual.pdf'])
    expect((await loadImageIndex('s1', 7)).map((record) => record.fileName)).toEqual(['en_US_holdings__map.png'])
    expect(listHelpFiles).toHaveBeenCalledTimes(1)
    expect(listHelpFiles).toHaveBeenCalledWith('s1', 7, ALL_FILE_TYPES)
  })

  it('lists each plugin row once per session', async () => {
    await loadGuideIndex('s1', 7)
    await loadGuideIndex('s1', 8)
    await loadGuideIndex('s1', 7)
    expect(listHelpFiles).toHaveBeenCalledTimes(2)
    await loadGuideIndex('s2', 7)
    expect(listHelpFiles).toHaveBeenCalledTimes(3)
  })

  it('asks again after a listing failed', async () => {
    vi.mocked(listHelpFiles).mockRejectedValueOnce(new Error('offline'))
    await expect(loadGuideIndex('s1', 7)).rejects.toThrow('offline')
    expect(await loadGuideIndex('s1', 7)).toHaveLength(2)
    expect(listHelpFiles).toHaveBeenCalledTimes(2)
  })

  it('lists again once cleared, and tells the subscribers the new version', async () => {
    const notify = vi.fn()
    const unsubscribe = subscribeHelpIndex(notify)
    await loadGuideIndex('s1', 7)
    const version = getHelpIndexVersion()

    clearHelpIndexCache()
    await loadGuideIndex('s1', 7)

    expect(listHelpFiles).toHaveBeenCalledTimes(2)
    expect(getHelpIndexVersion()).toBe(version + 1)
    expect(notify).toHaveBeenCalledWith(version + 1)
    unsubscribe()
    clearHelpIndexCache()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('lists the modules once per session, and again after a failure', async () => {
    await loadHelpModules('s1')
    await loadHelpModules('s1')
    expect(listHelpModules).toHaveBeenCalledTimes(1)
    await loadHelpModules('s2')
    expect(listHelpModules).toHaveBeenCalledTimes(2)

    vi.mocked(listHelpModules).mockRejectedValueOnce(new Error('offline'))
    clearHelpIndexCache()
    await expect(loadHelpModules('s2')).rejects.toThrow('offline')
    expect(await loadHelpModules('s2')).toEqual([{ id: 'farm-registry' }])
  })

  describe('loadGuideFigures', () => {
    const anchor = { anchorId: 7, locale: 'mk_MK', slug: 'holdings' }
    const cache = { get: vi.fn(async (session, record) => (record.fileName.includes('missing') ? null : `blob:${record.fileName}`)) }

    beforeEach(() => {
      vi.mocked(listHelpFiles).mockResolvedValue([
        file('mk_MK_holdings__map.png', 'HELP_IMAGE'),
        file('holdings__legend.png', 'HELP_IMAGE'),
        file('mk_MK_holdings__missing.png', 'HELP_IMAGE')
      ])
    })

    it("gets each figure the document names, its own upload or the one its translations share", async () => {
      expect(await loadGuideFigures('s1', anchor, ['map.png', 'legend.png'], cache)).toEqual({
        'map.png': 'blob:mk_MK_holdings__map.png',
        'legend.png': 'blob:holdings__legend.png'
      })
      expect(cache.get).toHaveBeenCalledWith('s1', expect.objectContaining({ fileName: 'mk_MK_holdings__map.png' }))
    })

    it('leaves out a figure it cannot find or read', async () => {
      expect(await loadGuideFigures('s1', anchor, ['photo.png', 'missing.png'], cache)).toEqual({})
    })

    it('lists nothing without a document or names', async () => {
      expect(await loadGuideFigures('s1', {}, ['map.png'], cache)).toEqual({})
      expect(await loadGuideFigures('s1', anchor, [], cache)).toEqual({})
      expect(listHelpFiles).not.toHaveBeenCalled()
    })
  })
})
