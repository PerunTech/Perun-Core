import { useEffect, useLayoutEffect, useRef } from 'react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';

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

/* A Select of more options than this draws only the ones in its menu's view, OVERSCAN more past each
end of it and AROUND_FOCUSED either side of the option moved to. The ones round the option moved to
are there for its id, which the input names as the active option, and so that a menu opened at an
option far down its list, or a key that moves to one, does not show its list empty until the
scroll is answered. An option not drawn yet is taken to be as high as the lowest one drawn, an
option on one line, or OPTION_HEIGHT before any is. */
const VIRTUAL_FROM = 100
const OVERSCAN = 10
const AROUND_FOCUSED = 15
const OPTION_HEIGHT = 34

/* Where the option at `index` is in the menu's list while it is drawn: its `top`, counted from the
menu as offsetTop counts it and so as the list's scrollTop does, and its `height`. A virtual list's
option is where its virtualizer has it, since the virtualizer measures the options as they are
drawn and moves them by what it found, so that a render later the option is there. */
function optionPlace(menu, index, virtualizer) {
  if (!menu || index === null) {
    return null
  }
  if (!virtualizer) {
    const option = menu.children[index]
    return option ? { top: option.offsetTop, height: option.offsetHeight } : null
  }
  const option = menu.querySelector(`[data-index="${index}"]`)
  const item = option && virtualizer.getVirtualItems().find((candidate) => candidate.index === index)
  // Its options are placed in a box of their own, which is where they are counted from.
  return item ? { top: option.offsetParent.offsetTop + item.start, height: item.size } : null
}

/**
 * The Select's menu while it is open: placed at the control on each render (see placeMenu), and
 * again when something round it scrolls or the window changes size, with the option moved to kept
 * in view in its list, as in react-select. A long list is virtual (see VIRTUAL_FROM).
 * @param {boolean} open - Whether the menu is drawn.
 * @param {number} focusedIndex - The option moved to, as an index into the menu, or null.
 * @param {number} count - The options in the menu.
 * @param {number} optionCount - The Select's options, which decide whether its list is virtual,
 *   so that it does not change between the two as the text typed narrows it.
 * @returns {object} The refs for the control (`controlRef`), the menu (`outerRef`) and its
 *   scrolling list (`menuRef`); `virtualizer`, the TanStack virtualizer the list is drawn from, or
 *   null when it is drawn whole; `scrollOnOpen()`, after which the option moved to is scrolled into
 *   view again the next time the menu is drawn open, as it is once each time it opens; and
 *   `scrollOnMove()`, after which it is brought into view on the next render, for a move by key.
 */
export default function useMenu(open, focusedIndex, count, optionCount) {
  const controlRef = useRef(null)
  const outerRef = useRef(null)
  const menuRef = useRef(null)
  const scrolledToOption = useRef(false)
  const scrollToFocused = useRef(false)
  const optionHeight = useRef(null)

  const virtual = optionCount > VIRTUAL_FROM
  const virtualizer = useVirtualizer({
    enabled: open && virtual,
    count: virtual ? count : 0,
    getScrollElement: () => menuRef.current,
    estimateSize: () => optionHeight.current ?? OPTION_HEIGHT,
    // As exactly as the page has it, where TanStack rounds, so that the options are where a list drawn whole has them.
    measureElement: (element, entry) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height
      if (height > 0) {
        optionHeight.current = Math.min(optionHeight.current ?? height, height)
      }
      return height
    },
    overscan: OVERSCAN,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      if (focusedIndex === null) {
        return indexes
      }
      const around = new Set(indexes)
      for (let i = Math.max(focusedIndex - AROUND_FOCUSED, 0); i <= Math.min(focusedIndex + AROUND_FOCUSED, range.count - 1); i++) {
        around.add(i)
      }
      return [...around].sort((a, b) => a - b)
    }
  })

  useLayoutEffect(() => {
    if (open) {
      placeMenu(controlRef.current, outerRef.current, menuRef.current)
    }
    const menu = menuRef.current
    const option = optionPlace(menu, focusedIndex, virtual ? virtualizer : null)
    if (open && option && !scrolledToOption.current) {
      if (menu.scrollTop > option.top || menu.scrollTop + menu.offsetHeight < option.top + option.height) {
        menu.scrollTop = option.top
      }
      scrolledToOption.current = true
    } else if (!open) {
      scrolledToOption.current = false
    }
    if (scrollToFocused.current && option) {
      scrollToFocused.current = false
      if (option.top + option.height > menu.scrollTop + menu.offsetHeight) {
        menu.scrollTop = option.top + option.height - menu.offsetHeight
      } else if (option.top < menu.scrollTop) {
        menu.scrollTop = option.top
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
    virtualizer: virtual ? virtualizer : null,
    scrollOnOpen: () => {
      scrolledToOption.current = false
    },
    scrollOnMove: () => {
      scrollToFocused.current = true
    }
  }
}
