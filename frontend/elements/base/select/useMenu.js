import { useEffect, useLayoutEffect, useRef } from 'react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';

// The space kept between the menu and the window's edge, and the least the menu is shortened to.
const WINDOW_MARGIN = 8
const MIN_MENU_HEIGHT = 100

// Fixed to the window, so a box that scrolls or clips doesn't cut it off. Set with priority, since some
// deployments' sheets place the menu themselves; a transformed ancestor's offset is made up for.
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

// Past VIRTUAL_FROM options only the ones in view are drawn, and AROUND_FOCUSED either side of the
// focused one, so it has an id and a menu opened far down its list isn't drawn empty.
const VIRTUAL_FROM = 100
const OVERSCAN = 10
const AROUND_FOCUSED = 15
const OPTION_HEIGHT = 34

// Where the virtualizer has the option, since it moves options by what it measured.
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

// optionCount, not count, decides whether the list is virtual, so it doesn't flip as typing narrows it.
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
