import { useEffect, useLayoutEffect, useRef } from 'react';

// The space kept between the menu and the window's edge, and the least the menu is shortened to.
const WINDOW_MARGIN = 8
const MIN_MENU_HEIGHT = 100

/* Puts the menu (outer, with its scrolling list, menu) at the control, fixed to the window, so that a
form or grid that scrolls, or hides what overflows it, does not cut it off. It goes below the control,
or above it when it does not fit below and there is more room above, and its list is shortened to the
room there is. The gap to the control is the menu's top margin, from the sheet. The position is set
with priority, since deployments' sheets place the menu themselves (some in the page's flow, with
`position: relative !important`), and a transformed box round the dropdown, which a fixed box is
placed from instead of the window, is made up for by moving the menu as far as it landed off. */
function placeMenu(control, outer, menu) {
  if (!control || !outer || !menu) {
    return
  }
  const set = (element, property, value) => element.style.setProperty(property, value, 'important')
  // Out of the flow first: just drawn, it is in it, and can move the control (in a centred cell).
  set(outer, 'position', 'fixed')
  const rect = control.getBoundingClientRect()
  set(outer, 'right', 'auto')
  set(outer, 'bottom', 'auto')
  set(outer, 'width', `${rect.width}px`)
  menu.style.removeProperty('max-height')
  const gap = parseFloat(getComputedStyle(outer).marginTop) || 0
  const height = outer.offsetHeight
  const below = document.documentElement.clientHeight - rect.bottom - gap - WINDOW_MARGIN
  const above = rect.top - gap - WINDOW_MARGIN
  const up = height > below && above > below
  const room = Math.max(up ? above : below, MIN_MENU_HEIGHT)
  if (height > room) {
    set(menu, 'max-height', `${room - (height - menu.offsetHeight)}px`)
  }
  const top = up ? rect.top - 2 * gap - outer.offsetHeight : rect.bottom
  set(outer, 'top', `${top}px`)
  set(outer, 'left', `${rect.left}px`)
  const placed = outer.getBoundingClientRect()
  const offTop = placed.top - (top + gap)
  const offLeft = placed.left - rect.left
  if (Math.abs(offTop) > 0.5 || Math.abs(offLeft) > 0.5) {
    set(outer, 'top', `${top - offTop}px`)
    set(outer, 'left', `${rect.left - offLeft}px`)
  }
}

/**
 * The Select's menu while it is open: placed at the control on each render (see placeMenu), and
 * again when something round it scrolls or the window changes size, with the option moved to kept
 * in view in its list, as in react-select.
 * @param {boolean} open - Whether the menu is drawn.
 * @param {number} focusedIndex - The option moved to, as an index into the menu, or null.
 * @returns {object} The refs for the control (`controlRef`), the menu (`outerRef`) and its
 *   scrolling list (`menuRef`); `scrollOnOpen()`, after which the option moved to is scrolled into
 *   view again the next time the menu is drawn open, as it is once each time it opens; and
 *   `scrollOnMove()`, after which it is brought into view on the next render, for a move by key.
 */
export default function useMenu(open, focusedIndex) {
  const controlRef = useRef(null)
  const outerRef = useRef(null)
  const menuRef = useRef(null)
  const scrolledToOption = useRef(false)
  const scrollToFocused = useRef(false)

  useLayoutEffect(() => {
    if (open) {
      placeMenu(controlRef.current, outerRef.current, menuRef.current)
    }
    const menu = menuRef.current
    const option = menu && focusedIndex !== null ? menu.children[focusedIndex] : null
    if (open && option && !scrolledToOption.current) {
      if (menu.scrollTop > option.offsetTop || menu.scrollTop + menu.offsetHeight < option.offsetTop + option.offsetHeight) {
        menu.scrollTop = option.offsetTop
      }
      scrolledToOption.current = true
    } else if (!open) {
      scrolledToOption.current = false
    }
    if (scrollToFocused.current && option) {
      scrollToFocused.current = false
      const optionRect = option.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      if (optionRect.bottom > menuRect.bottom) {
        menu.scrollTop = option.offsetTop + option.clientHeight - menu.offsetHeight
      } else if (optionRect.top < menuRect.top) {
        menu.scrollTop = option.offsetTop
      }
    }
  })

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const place = () => placeMenu(controlRef.current, outerRef.current, menuRef.current)
    const onScroll = (event) => {
      if (!menuRef.current || !menuRef.current.contains(event.target)) {
        place()
      }
    }
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  return {
    controlRef,
    outerRef,
    menuRef,
    scrollOnOpen: () => {
      scrolledToOption.current = false
    },
    scrollOnMove: () => {
      scrollToFocused.current = true
    }
  }
}
