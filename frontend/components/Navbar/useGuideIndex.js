import { useEffect, useState } from 'react'
import {
  CORE_MODULE, getHelpIndexVersion, guidesForRoute, loadGuideIndex, loadHelpModules,
  moduleIdFromPath, subscribeHelpIndex
} from '../../elements/guides/routeGuides'

// Re-read on every route change, which the per-tab cache makes cheap. indexFailed is kept apart from
// an empty list, since the two want different words on screen.
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

        // Tagged with the plugin row, so opening one needn't re-derive its anchor.
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
        // The button stays so the reader can find out why.
        setGuides([])
        setIndexFailed(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [svSession, pathname, locale, indexVersion])

  return { guides, indexFailed }
}
