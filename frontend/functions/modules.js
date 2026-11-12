// UMD can't code-split, so the large libraries are ES modules beside perun-core.js (build/modules.mjs),
// loaded with import(). Each URL carries a content version, so a cached module never meets a newer bundle.

const FILES = typeof __PERUN_CORE_MODULES__ === 'undefined' ? {} : __PERUN_CORE_MODULES__

// document.currentScript is only set while the bundle evaluates, so it is read at module level.
const loadedFrom = typeof document === 'undefined' ? null : document.currentScript?.src || null

// For a bundle evaluated without a current script: its own tag, found by name.
const bundleUrl = () => loadedFrom ??
  (typeof document === 'undefined'
    ? null
    : Array.from(document.scripts).find(script => /\/perun-core\.js(\?|$)/.test(script.src))?.src ?? null)

export const moduleUrl = (name, base, files = FILES) =>
  base && files[name] ? new URL(files[name], base).href : null

const loading = new Map()

// A failed load is forgotten, so the next attempt retries.
export const loadModule = (name) => {
  if (!loading.has(name)) {
    const url = moduleUrl(name, bundleUrl())
    const pending = url
      ? import(/* @vite-ignore */ url)
      : Promise.reject(new Error(`perun-core: cannot tell where the ${name} module is. ` +
        'It is loaded from beside perun-core.js, and that script could not be found.'))
    pending.catch(() => loading.delete(name))
    loading.set(name, pending)
  }
  return loading.get(name)
}
