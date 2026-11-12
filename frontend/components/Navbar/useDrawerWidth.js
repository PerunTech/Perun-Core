import { useCallback, useEffect, useState } from 'react'

const WIDTH_KEY = 'perun.help_panel_width'
const DEFAULT_WIDTH = 560

// Bounded by the viewport, so a width stored on a wide monitor fits a smaller one.
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

// resized: moved off the default, which decides whether the reset control shows.
export const useDrawerWidth = (drawerRef, open) => {
  const [width, setWidth] = useState(storedWidth)

  // Also measured on opening, since the window may have narrowed while the drawer was shut.
  useEffect(() => {
    if (!open) return undefined
    const measure = () => setWidth(current => clampWidth(current))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  // Written straight to the node while dragging and committed on release: a render per pointermove
  // would rebuild a long guide's markup every frame.
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
