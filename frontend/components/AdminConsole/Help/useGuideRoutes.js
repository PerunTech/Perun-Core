import { useCallback, useMemo } from 'react'
import { router } from '../../../routes/Router'
import { moduleIdFromPath } from '../../../elements/guides/routeGuides'

/**
 * The routes a guide may be filed against, and the module each one belongs to.
 *
 * Its own hook because naming the module behind a path is the one piece of reasoning in this
 * screen that is neither storage nor presentation: it reconciles what the backend calls a module,
 * what a plugin registered as a route, and what an author typed into the route field, three
 * spellings of the same thing that agree less often than they look.
 *
 * @param {object[]} modules       from listHelpModules: { id, title, objectId }
 * @param {object[]} docs          the stored guides, for routes only they know about
 * @param {object}   routeRegistry state.routes, as name -> <Route path=... />
 * @param {Function} fmt           label lookup
 * @returns {{routes: object[], moduleLabel: Function}}
 */
export const useGuideRoutes = (modules, docs, routeRegistry, fmt) => {
  /**
   * Path segments a module serves under a name other than its own, as a segment to module id map.
   *
   * A module's guides are usually spelled after it, /main/inventory, and the segment is the
   * module id. But a plugin may register whatever paths it likes: inventory may also serve
   * /main/stock, whose segment names no module at all. The plugin that registered a route is
   * the only thing that connects the two, so its own routes are grouped and the segment that does
   * name a known module is taken as its identity, with its other segments pointed at that.
   */
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
      // The bundle's own name is not assumed to be the module's context name, so the module is
      // identified by whichever of its segments the backend actually knows as a module.
      const known = [...segments].find(segment => modules.some(module => module.id === segment))
      if (known) segments.forEach(segment => { index[segment] = known })
    })
    return index
  }, [modules])

  /**
   * The module a route belongs to, as the list and the editor both name it.
   *
   * Asked of the route rather than of the row the guide is stored on. Those differ by design:
   * ownerModuleForRoute falls back to perun-core for any route naming no registered module, so
   * /main, /main/registry and a `:section(...)` pattern all land on the shared row. Reading that
   * storage back as a name told the author their guide belonged to whatever the deployment calls
   * its core plugin, which is a module the guide has nothing to do with.
   *
   * Shared is kept for a route that genuinely belongs to no module, /main above all, since that is
   * exactly what a general manual is.
   */
  const moduleLabel = useCallback((route) => {
    const segment = moduleIdFromPath(route)
    const id = modules.some(module => module.id === segment) ? segment : segmentOwners[segment]
    const named = modules.find(module => module.id === id)
    return named ? (named.title || named.id) : fmt('perun.admin_console.user_guides_module_shared')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, segmentOwners])

  // Route suggestions come from the registered modules plus whatever existing guides already point
  // at, which covers the common cases without a Router change.
  const appRoutes = useMemo(() => Object.entries(routeRegistry ?? {})
    // `loading` shares this slice with the registry, and a path may be declared as an array.
    .filter(([, element]) => element?.props?.path)
    .flatMap(([name, element]) => [element.props.path].flat().map(path => ({ value: path, label: name })))
    .filter(route => String(route.value).startsWith('/main')), [routeRegistry])

  const routes = useMemo(() => {
    // The name and the path are separate fields because RouteWidget shows them in two columns; a
    // label carrying its own path would print it twice.
    const fromModules = modules.map(module => ({ value: `/main/${module.id}`, label: module.title || module.id }))
    // A route only a saved guide knows about has no name to show, just its path.
    const fromDocs = docs.map(doc => doc.notes?.route).filter(Boolean).map(route => ({ value: route, label: '' }))
    // Every screen in the application. Route matching is a prefix match, so a guide here answers
    // below every module, which is what makes it a general manual; ownerModuleForRoute reads the
    // missing module segment and stores it on perun-core, which the reader consults everywhere.
    // Listed first, and so also the schema's default, because routes[0] is what the schema takes:
    // a guide whose route nobody narrowed is then readable everywhere rather than filed against
    // whichever module happened to sort first.
    const general = { value: '/main', label: fmt('perun.admin_console.user_guides_route_all') }
    // General first, then the module roots, then everything else the application registered, then
    // any route only a saved guide knows about. First mention of a path wins its label, which is
    // what keeps a module route labelled with its title rather than the registry's route name.
    const seen = new Set()
    return [general, ...fromModules, ...appRoutes, ...fromDocs]
      .filter(route => !seen.has(route.value) && seen.add(route.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, docs, appRoutes])

  return { routes, moduleLabel }
}
