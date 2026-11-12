import { useCallback, useMemo } from 'react'
import { router } from '../../../routes/Router'
import { moduleIdFromPath } from '../../../elements/guides/routeGuides'

export const useGuideRoutes = (modules, docs, routeRegistry, fmt) => {
  // Path segments a module serves under another name (inventory may serve /main/stock), mapped to the
  // module through the plugin that registered both.
  const segmentOwners = useMemo(() => {
    const byPlugin = new Map()
    Object.entries(router.routeOwners?.() ?? {}).forEach(([path, plugin]) => {
      const segment = moduleIdFromPath(path)
      if (!segment) return
      if (!byPlugin.has(plugin)) byPlugin.set(plugin, new Set())
      byPlugin.get(plugin).add(segment)
    })

    const index = {}
    byPlugin.forEach(segments => {
      // The bundle's name isn't assumed to be the module's context name.
      const known = [...segments].find(segment => modules.some(module => module.id === segment))
      if (known) segments.forEach(segment => { index[segment] = known })
    })
    return index
  }, [modules])

  // Asked of the route, not the row the guide is stored on: ownerModuleForRoute stores any route naming
  // no module on perun-core, which would read as the core plugin rather than Shared.
  const moduleLabel = useCallback((route) => {
    const segment = moduleIdFromPath(route)
    const id = modules.some(module => module.id === segment) ? segment : segmentOwners[segment]
    const named = modules.find(module => module.id === id)
    return named ? (named.title || named.id) : fmt('perun.admin_console.user_guides_module_shared')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, segmentOwners])

  // The registered routes plus whatever saved guides point at.
  const appRoutes = useMemo(() => Object.entries(routeRegistry ?? {})
    // loading shares this slice with the registry, and a path may be an array.
    .filter(([, element]) => element?.props?.path)
    .flatMap(([name, element]) => [element.props.path].flat().map(path => ({ value: path, label: name })))
    .filter(route => String(route.value).startsWith('/main')), [routeRegistry])

  const routes = useMemo(() => {
    // Name and path apart, since RouteWidget shows them in two columns.
    const fromModules = modules.map(module => ({ value: `/main/${module.id}`, label: module.title || module.id }))
    const fromDocs = docs.map(doc => doc.notes?.route).filter(Boolean).map(route => ({ value: route, label: '' }))
    // A prefix match makes /main answer everywhere. First, so it is also the schema's default
    // (routes[0]) and an unnarrowed guide is readable everywhere.
    const general = { value: '/main', label: fmt('perun.admin_console.user_guides_route_all') }
    // The first mention of a path wins its label, so a module route keeps its title.
    const seen = new Set()
    return [general, ...fromModules, ...appRoutes, ...fromDocs]
      .filter(route => !seen.has(route.value) && seen.add(route.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, docs, appRoutes])

  return { routes, moduleLabel }
}
