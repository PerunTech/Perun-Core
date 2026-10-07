import { useEffect, useState } from 'react'
import {
  CORE_MODULE, getHelpIndexVersion, guidesForRoute, loadGuideIndex, loadHelpModules,
  moduleIdFromPath, subscribeHelpIndex
} from '../../elements/guides/routeGuides'

/**
 * The guides that answer for the route the reader is on.
 *
 * Re-read on every route change, which sounds expensive and is not: both indexes are cached per
 * tab, so this settles to zero requests once a module has been visited. A write in the Admin
 * Console drops that cache and bumps a version, which is what brings a newly saved guide into the
 * navbar without a reload, and what stops a deleted one's button from lingering.
 *
 * @returns {{guides: object[], indexFailed: boolean}}
 *   `indexFailed` is deliberately distinct from an empty list: a lookup that failed must not
 *   masquerade as a screen nobody has documented, because the two want different words on screen.
 */
export const useGuideIndex = (svSession, pathname, locale) => {
  const [guides, setGuides] = useState([])
  const [indexFailed, setIndexFailed] = useState(false)
  const [indexVersion, setIndexVersion] = useState(getHelpIndexVersion)

  useEffect(() => subscribeHelpIndex(setIndexVersion), [])

  // The current route's module plus perun-core, which holds the cross-module guides.
  useEffect(() => {
    if (!svSession) return undefined
    let cancelled = false

    const load = async () => {
      try {
        const modules = await loadHelpModules(svSession)
        if (cancelled) return

        const wanted = [moduleIdFromPath(pathname), CORE_MODULE].filter(Boolean)
        const owners = modules.filter(module => wanted.includes(module.id))

        // Records are tagged with the plugin row they came off, so opening one does not have to
        // re-derive its anchor from a lookup table that changes identity on every route change.
        const indexes = await Promise.all(owners.map(async owner => {
          const records = await loadGuideIndex(svSession, owner.objectId)
          return records.map(record => ({ ...record, anchorId: owner.objectId }))
        }))
        if (cancelled) return

        setGuides(guidesForRoute(indexes.flat(), pathname, locale))
        setIndexFailed(false)
      } catch (err) {
        console.error('Could not load the help index', err)
        if (cancelled) return
        // The button stays so the reader can find out why, rather than the feature vanishing with
        // the same silence as a route nobody has documented.
        setGuides([])
        setIndexFailed(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [svSession, pathname, locale, indexVersion])

  return { guides, indexFailed }
}
