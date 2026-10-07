import { useCallback, useEffect, useState } from 'react'
import { alertUserV2, alertUserResponse } from '../../../elements'
import { getServerOrigin } from '../../../functions/utils'
import { listHelpModules } from '../../../elements/guides/helpModules'
import { loadGuideIndex } from '../../../elements/guides/routeGuides'

/**
 * What the screen is working on: the modules that can own guides, the locales on offer, and every
 * stored guide across all of them.
 *
 * Separate from the screen's own state because the two have different lifetimes. This is read once
 * on entering the section and again after each write; everything else in the component is what the
 * author is doing right now, and none of it survives a reload.
 *
 * @param {Function} fmt label lookup, for the one case this reports itself
 * @returns {{modules: object[], docs: object[], locales: object[], booting: boolean,
 *            anchorFor: Function, reloadDocs: Function}}
 *   `booting` is the first read only. A write's own progress belongs to the surface that started it.
 */
export const useGuideStore = (svSession, fmt) => {
  const [modules, setModules] = useState([])
  const [docs, setDocs] = useState([])
  const [locales, setLocales] = useState([])
  const [booting, setBooting] = useState(true)

  /** Guides live under each module's own plugin row, so the list is the union across bundles. */
  const loadDocs = useCallback(async (moduleList) => {
    const perModule = await Promise.all(moduleList.map(async (module) => {
      try {
        // The reader's cached index rather than a listing of its own: it is the same one call per
        // plugin row, and every write here clears that cache, so the two cannot drift apart.
        const records = await loadGuideIndex(svSession, module.objectId)
        return records.map(record => ({ ...record, module: module.id, anchorId: module.objectId }))
      } catch (err) {
        // One module failing to answer should not blank the whole list.
        console.error(`Could not read guides for ${module.id}`, err)
        return []
      }
    }))
    setDocs(perModule.flat())
  }, [svSession])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      try {
        const [moduleList, languages] = await Promise.all([
          listHelpModules(svSession),
          fetch(`${getServerOrigin()}${window.assets}/json/config/LanguageOptions.json`)
            .then(res => res.json())
            .catch(() => []),
        ])
        if (cancelled) return

        if (!moduleList.length) {
          setBooting(false)
          alertUserV2({ type: 'info', title: fmt('perun.admin_console.user_guides_no_anchor') })
          return
        }

        setModules(moduleList)
        setLocales((languages ?? []).map(item => ({ value: item.language, label: item.label || item.language })))
        await loadDocs(moduleList)
      } catch (err) {
        console.error(err)
        // A request already in flight when the session changed rejects after this effect has been
        // torn down. The reader is on their way to the login screen by then, so reporting it is
        // noise about something they did on purpose.
        if (cancelled) return
        alertUserResponse({ response: err })
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    // No session is a logout in progress, not a section that failed to load. Asking anyway would
    // return a 401, which the global interceptor swallows into a resolved empty answer, which
    // requireResponse then has to throw on.
    if (svSession) boot()
    else setBooting(false)

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svSession, loadDocs])

  /** The plugin row a module's files hang off. */
  const anchorFor = useCallback(
    (moduleId) => modules.find(module => module.id === moduleId)?.objectId ?? null,
    [modules]
  )

  /** Re-reads the list after a write, which is the only thing that changes it. */
  const reloadDocs = useCallback(() => loadDocs(modules), [loadDocs, modules])

  return { modules, docs, locales, booting, anchorFor, reloadDocs }
}
