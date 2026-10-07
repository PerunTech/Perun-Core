import { useCallback, useEffect, useState } from 'react'

/**
 * The help drawer's width: remembered between sessions, dragged by its leading edge.
 *
 * Its own hook because none of it is about guides. The panel that reads a manual beside the screen
 * it describes has to be sizeable, and how wide it may be, where that is stored and what a drag
 * does are one concern with one piece of state.
 */

const WIDTH_KEY = 'perun.help_panel_width'
const DEFAULT_WIDTH = 560

// Bounded by the viewport rather than by constants alone, so a width stored on a wide monitor does
// not leave the drawer wider than the screen it is later opened on.
const clampWidth = (value) => {
  const max = Math.max(280, window.innerWidth - 60)
  const min = Math.min(360, max)
  return Math.min(Math.max(value, min), max)
}

const storedWidth = () => {
  try {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY))
    return saved ? clampWidth(saved) : DEFAULT_WIDTH
  } catch {
    // Private windows and blocked site data throw on access rather than returning null.
    return DEFAULT_WIDTH
  }
}

const rememberWidth = (value) => {
  try { window.localStorage.setItem(WIDTH_KEY, String(value)) } catch { /* not worth reporting */ }
}

/**
 * @param {object} drawerRef the panel element, written to directly while dragging
 * @param {boolean} open     only a drawer on screen follows the viewport
 * @returns {{width: number, startResize: Function, resetWidth: Function, resized: boolean}}
 *   `resized` is whether the reader has moved it off the default, which is what decides whether
 *   the reset control is worth showing.
 */
export const useDrawerWidth = (drawerRef, open) => {
  const [width, setWidth] = useState(storedWidth)

  // A window narrowed while the drawer is open would otherwise leave it wider than the viewport.
  // Measured on opening as well as on resize, because the window can be narrowed while the drawer
  // is shut, when there is no listener to catch it.
  useEffect(() => {
    if (!open) return undefined
    const measure = () => setWidth(current => clampWidth(current))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  /**
   * Drag the drawer's leading edge.
   *
   * The width is written straight to the node while dragging and only committed to state on
   * release: a render per pointermove would rebuild the whole panel, a long guide's markup
   * included, on every frame of the drag.
   */
  const startResize = useCallback((event) => {
    event.preventDefault()
    const drawer = drawerRef.current
    if (!drawer) return

    let next = drawer.getBoundingClientRect().width
    document.body.classList.add('help-resizing')

    const onMove = (move) => {
      next = clampWidth(window.innerWidth - move.clientX)
      drawer.style.width = `${next}px`
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.classList.remove('help-resizing')
      setWidth(next)
      rememberWidth(next)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [drawerRef])

  const resetWidth = useCallback(() => {
    const value = clampWidth(DEFAULT_WIDTH)
    if (drawerRef.current) drawerRef.current.style.width = `${value}px`
    setWidth(value)
    rememberWidth(value)
  }, [drawerRef])

  return { width, startResize, resetWidth, resized: Math.abs(width - clampWidth(DEFAULT_WIDTH)) > 1 }
}
