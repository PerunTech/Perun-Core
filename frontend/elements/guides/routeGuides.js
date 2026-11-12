import { matchPath } from 'react-router-dom'
import {
  HELP_DOC, HELP_IMAGE, HELP_PDF, displayImageName, helpFileType, newestByName, resolveImageRecord
} from './helpNames'
import { ALL_FILE_TYPES, listHelpFiles } from './helpApi'
import { listHelpModules } from './helpModules'

// Guides that belong to no module, always read alongside the route's module.
export const CORE_MODULE = 'perun-core'

// Cached for the tab: a save writes a new file row, so a cached index can miss a new guide but never
// serve a stale one. The admin section clears it after a save.
let modulePromise = null
// One listing per plugin row for all three types, since the store answers them in one call.
const fileIndex = new Map()

// Readers refetch on a version change: clearing the cache alone leaves a mounted panel as it was.
let indexVersion = 0
const listeners = new Set()

export const clearHelpIndexCache = () => {
  cacheSession = null
  modulePromise = null
  fileIndex.clear()
  indexVersion += 1
  listeners.forEach(notify => notify(indexVersion))
}

export const subscribeHelpIndex = (notify) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export const getHelpIndexVersion = () => indexVersion

// A re-login doesn't reload the page and the next session may see other guides, so it starts empty.
let cacheSession = null

const forSession = (svSession) => {
  if (cacheSession === svSession) return
  cacheSession = svSession
  modulePromise = null
  fileIndex.clear()
}

// newestByName keys on the name, where the three types can't collide (extension, `__` separator).
const cachedFiles = (svSession, objectId) => {
  forSession(svSession)
  if (!fileIndex.has(objectId)) {
// A failed lookup isn't cached, so the next route change retries it.
    fileIndex.set(objectId, listHelpFiles(svSession, objectId, ALL_FILE_TYPES)
      .then(newestByName)
      .catch(err => { fileIndex.delete(objectId); throw err }))
  }
  return fileIndex.get(objectId)
}

const ofType = async (svSession, objectId, wanted) => {
  const files = await cachedFiles(svSession, objectId)
  return files.filter(record => wanted.includes(helpFileType(record)))
}

export const loadHelpModules = (svSession) => {
  forSession(svSession)
  if (!modulePromise) {
    modulePromise = listHelpModules(svSession).catch(err => { modulePromise = null; throw err })
  }
  return modulePromise
}

export const loadImageIndex = (svSession, objectId) => ofType(svSession, objectId, [HELP_IMAGE])

export const loadGuideIndex = (svSession, objectId) => ofType(svSession, objectId, [HELP_DOC, HELP_PDF])

// Keyed by the name the author wrote. Names come from the caller so this module stays clear of the
// Markdown renderer.
export const loadGuideFigures = async (svSession, { anchorId, locale, slug } = {}, names, cache) => {
  if (!anchorId || !names?.length) return {}

  const records = await loadImageIndex(svSession, anchorId)
  const stem = `${locale}_${slug}`
  const pairs = await Promise.all(names.map(async (name) => {
    const found = resolveImageRecord(records, stem, name)
    return [name, found ? await cache.get(svSession, found) : null]
  }))
  return Object.fromEntries(pairs.filter(([, url]) => url))
}

// Stored names carry the document stem (en_US_guide__diagram.png); the Markdown may use either.
export const figureResolver = (images) => (name) =>
  images?.[name] ?? images?.[displayImageName(name)] ?? null

export const moduleIdFromPath = (pathname) =>
  matchPath(pathname ?? '', { path: '/main/:moduleId' })?.params?.moduleId ?? null

// The reader looks only in the route's module and perun-core, so the anchor is derived, never picked.
export const ownerModuleForRoute = (route, modules) => {
  const id = moduleIdFromPath(route)
  return id && (modules ?? []).some(module => module.id === id) ? id : CORE_MODULE
}

// A prefix match, so a guide for /main/holdings answers on /main/holdings/42. The deeper route ranks
// first, and on a tie a literal beats a parameter.
const scoreRoute = (route, pathname) => {
  if (!route || !String(route).startsWith('/')) return null
  const match = matchPath(pathname ?? '', { path: route, exact: false })
  if (!match) return null
  return { depth: match.url.length, params: Object.keys(match.params ?? {}).length }
}

// Redux carries the locale as en-US while filenames carry en_US.
const normalizeLocale = (locale) => String(locale || 'en_US').replace('-', '_')

const localeRank = (candidate, wanted) => {
  if (candidate === wanted) return 0
  if (candidate === 'en_US') return 1
  return 2
}

// Slugs are unique only within a module and the reader merges two modules, so records key on both.
export const pickLocale = (records, locale) => {
  const wanted = normalizeLocale(locale)
  const best = new Map()

  records.forEach(record => {
    const key = `${record.notes?.module ?? ''}:${record.slug}`
    const held = best.get(key)
    if (!held || localeRank(record.locale, wanted) < localeRank(held.locale, wanted)) best.set(key, record)
  })

  return [...best.values()].filter(record => localeRank(record.locale, wanted) < 2)
}

export const guidesForRoute = (records, pathname, locale) =>
  pickLocale(records ?? [], locale)
    .map(record => ({ record, score: scoreRoute(record.notes?.route, pathname) }))
    .filter(entry => entry.score)
    .sort((a, b) =>
      b.score.depth - a.score.depth
      || a.score.params - b.score.params
      || (Number(a.record.notes?.order) || 0) - (Number(b.record.notes?.order) || 0)
      || String(a.record.notes?.title ?? a.record.slug).localeCompare(String(b.record.notes?.title ?? b.record.slug)))
    .map(entry => entry.record)

export const guideTitle = (record) =>
  String(record?.notes?.title || '').trim() || String(record?.slug ?? '').replace(/[-_]+/g, ' ')
