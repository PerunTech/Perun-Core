import { matchPath } from 'react-router-dom'
import {
  HELP_DOC, HELP_IMAGE, HELP_PDF, displayImageName, helpFileType, newestByName, resolveImageRecord
} from './helpNames'
import { ALL_FILE_TYPES, listHelpFiles } from './helpApi'
import { listHelpModules } from './helpModules'

// perun-core owns the guides that are not specific to any one module, so it is always consulted
// alongside whichever module the current route belongs to.
export const CORE_MODULE = 'perun-core'

/* ------------------------------------------------------------------ cache -- */

// Indexes are cached for the life of the tab. Every save writes a new file row rather than
// mutating one, so a cached index can only ever be missing a new document, never serving a stale
// one; the admin section clears the cache after a save to pick those up.
let modulePromise = null
// One listing per plugin row, holding guides, manuals and figures together. Split by type on read
// rather than fetched per type, because the store answers all three in a single call.
const fileIndex = new Map()

// Readers key their fetch on the route, so clearing the cache alone leaves a mounted panel showing
// what it already had. That matters when an author edits a guide for the screen they are standing
// on, which is the normal case for the Admin Console's own guides. Subscribers get a version to
// depend on rather than a callback to call, so the reader's existing effect does the refetch.
let indexVersion = 0
const listeners = new Set()

export const clearHelpIndexCache = () => {
  cacheSession = null
  modulePromise = null
  fileIndex.clear()
  indexVersion += 1
  listeners.forEach(notify => notify(indexVersion))
}

/** Subscribes to cache invalidation. Returns the unsubscribe. */
export const subscribeHelpIndex = (notify) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export const getHelpIndexVersion = () => indexVersion

// What one session was allowed to see is not what the next one sees, so a new session starts from
// an empty cache. Without this, a lookup that ran against an expired session sticks: the global
// interceptor turns a 401 into a resolved empty answer (see requireResponse in helpApi), that
// empty answer is cached as "this module has no guides", and logging back in does not clear it
// because a re-login is a state change rather than a page load. The symptom is the navbar button
// staying missing on a route that has a guide until the tab is reloaded.
let cacheSession = null

const forSession = (svSession) => {
  if (cacheSession === svSession) return
  cacheSession = svSession
  modulePromise = null
  fileIndex.clear()
}

/**
 * Every help file on one plugin row, newest version of each name, cached for the session.
 *
 * newestByName keys on the file name, and the three types cannot collide there: a guide and a
 * manual differ by extension, and a figure carries its document's stem and the `__` separator.
 */
const cachedFiles = (svSession, objectId) => {
  forSession(svSession)
  if (!fileIndex.has(objectId)) {
    // The rejected promise is dropped rather than cached, so a failed lookup retries on the next
    // route change instead of pinning the panel shut for the session.
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

/**
 * Every guide a module offers, written here or uploaded as a PDF.
 *
 * The two are stored under different file types but are routed by the same notes and are one list
 * from the reader's point of view, so they are selected together here rather than at each call
 * site, where a surface could pick up one kind and quietly miss the other.
 */
export const loadGuideIndex = (svSession, objectId) => ofType(svSession, objectId, [HELP_DOC, HELP_PDF])

/* ---------------------------------------------------------------- figures -- */

/**
 * Object URLs for a guide's figures, keyed by the name the author wrote in the Markdown.
 *
 * Shared by every surface that renders a stored guide, reader and exporter alike: a printed guide
 * that resolves its figures differently from the one on screen is a guide that prints wrong.
 * Figure names are taken from the caller rather than scanned here, so this module stays clear of
 * the Markdown renderer.
 *
 * @param {object} anchor  { anchorId, locale, slug } of the document being rendered
 * @param {string[]} names figure names the document references
 * @param {object} cache   a blob cache from createBlobCache
 */
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

/**
 * Lookup into a figure map for the renderer.
 *
 * The stored name carries the document stem (`en_US_guide__diagram.png`) while the Markdown carries
 * the display name, so both spellings resolve and a document written against either keeps working.
 */
export const figureResolver = (images) => (name) =>
  images?.[name] ?? images?.[displayImageName(name)] ?? null

/* ------------------------------------------------------------------ route -- */

/** The module a path belongs to. Routes are registered under /main/<context name>. */
export const moduleIdFromPath = (pathname) =>
  matchPath(pathname ?? '', { path: '/main/:moduleId' })?.params?.moduleId ?? null

/**
 * The module a guide must be stored under to be readable at its own route.
 *
 * The reader only ever consults the route's module and perun-core, so storing a guide anywhere else
 * makes it invisible however correct its route is. Deriving the anchor rather than letting an author
 * pick it is what keeps that state unreachable. Routes that belong to no module, such as /main,
 * fall to perun-core, which is also the fallback for a module the caller does not know about.
 */
export const ownerModuleForRoute = (route, modules) => {
  const id = moduleIdFromPath(route)
  return id && (modules ?? []).some(module => module.id === id) ? id : CORE_MODULE
}

/**
 * Scores how well a guide's declared route covers the current path, or null when it does not.
 *
 * Matching is deliberately non-exact so a guide written for /main/holdings still answers on
 * /main/holdings/42. Depth is how much of the path the route actually consumed, which is what
 * ranks a specific guide above the general one; params breaks ties so a literal route wins over a
 * parameterised one of the same length.
 */
const scoreRoute = (route, pathname) => {
  if (!route || !String(route).startsWith('/')) return null
  const match = matchPath(pathname ?? '', { path: route, exact: false })
  if (!match) return null
  return { depth: match.url.length, params: Object.keys(match.params ?? {}).length }
}

/* ----------------------------------------------------------------- locale -- */

// Redux carries the locale as en-US while filenames carry en_US.
const normalizeLocale = (locale) => String(locale || 'en_US').replace('-', '_')

const localeRank = (candidate, wanted) => {
  if (candidate === wanted) return 0
  if (candidate === 'en_US') return 1
  return 2
}

/**
 * One record per document, in the best available locale.
 *
 * Slugs are only unique within a module, and the reader merges two modules' indexes, so documents
 * are keyed by module and slug together.
 */
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

/* ---------------------------------------------------------------- combine -- */

/** Every guide that answers for a path, most specific first. */
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

/** The title a guide shows in the panel, falling back to its slug when the author left it blank. */
export const guideTitle = (record) =>
  String(record?.notes?.title || '').trim() || String(record?.slug ?? '').replace(/[-_]+/g, ' ')
