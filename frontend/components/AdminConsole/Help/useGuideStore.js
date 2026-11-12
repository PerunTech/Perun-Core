import { useCallback, useEffect, useState } from 'react'
import { alertUserV2, alertUserResponse } from '../../../elements'
import { getServerOrigin } from '../../../functions/utils'
import { listHelpModules } from '../../../elements/guides/helpModules'
import { loadGuideIndex } from '../../../elements/guides/routeGuides'

export const useGuideStore = (svSession, fmt) => {
  const [modules, setModules] = useState([])
  const [docs, setDocs] = useState([])
  const [locales, setLocales] = useState([])
  const [booting, setBooting] = useState(true)

  const loadDocs = useCallback(async (moduleList) => {
    const perModule = await Promise.all(moduleList.map(async (module) => {
      try {
        // The reader's cached index, which every write here clears, so the two can't drift apart.
        const records = await loadGuideIndex(svSession, module.objectId)
        return records.map(record => ({ ...record, module: module.id, anchorId: module.objectId }))
      } catch (err) {
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
        // A request in flight when the session changed rejects after teardown; the user is logging out.
        if (cancelled) return
        alertUserResponse({ response: err })
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    // No session is a logout in progress; asking would 401 into the interceptor's alert.
    if (svSession) boot()
    else setBooting(false)

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svSession, loadDocs])

  const anchorFor = useCallback(
    (moduleId) => modules.find(module => module.id === moduleId)?.objectId ?? null,
    [modules]
  )

  const reloadDocs = useCallback(() => loadDocs(modules), [loadDocs, modules])

  return { modules, docs, locales, booting, anchorFor, reloadDocs }
}
