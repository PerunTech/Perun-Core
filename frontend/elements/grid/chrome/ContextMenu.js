import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';

// Keeps react-contextmenu's markup and class names, which the deployments' sheets style. No submenus,
// dividers or collect/data: the grid uses none of them.

const HOLD_TO_DISPLAY_MS = 1000
// Over the grid's header and an open cell editor (CellEditor's is 10).
const Z_INDEX = 1000
const ITEM_CLASS = 'react-contextmenu-item'

const menus = new Set()

function showMenu(id, x, y) {
  menus.forEach((menu) => (menu.id === id ? menu.show(x, y) : menu.hide()))
}

function getPosition(node, x, y) {
  const { innerWidth, innerHeight } = window
  const rect = node.getBoundingClientRect()
  let top = y
  let left = x
  if (y + rect.height > innerHeight) {
    top -= rect.height
  }
  if (x + rect.width > innerWidth) {
    left -= rect.width
  }
  if (top < 0) {
    top = rect.height < innerHeight ? (innerHeight - rect.height) / 2 : 0
  }
  if (left < 0) {
    left = rect.width < innerWidth ? (innerWidth - rect.width) / 2 : 0
  }
  return { top, left }
}

// Shown by style rather than a re-render, once its size is known.
function placeMenu(node, { isVisible, x, y }) {
  if (isVisible) {
    const { top, left } = getPosition(node, x, y)
    node.style.top = `${top}px`
    node.style.left = `${left}px`
    node.style.opacity = 1
    node.style.pointerEvents = 'auto'
  } else {
    node.style.opacity = 0
    node.style.pointerEvents = 'none'
  }
}

function listen(listeners) {
  listeners.forEach(([target, type, listener]) => target.addEventListener(type, listener))
  return () => listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener))
}

function onMenuKey(event, items, selectedIndex, select, hide) {
  const last = items.length - 1
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      hide()
      break
    case 'ArrowUp':
      event.preventDefault()
      if (last >= 0) {
        select(selectedIndex === null || selectedIndex === 0 ? last : selectedIndex - 1)
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (last >= 0) {
        select(selectedIndex === null || selectedIndex === last ? 0 : selectedIndex + 1)
      }
      break
    case 'Enter':
      event.preventDefault()
      if (selectedIndex !== null && items[selectedIndex]) {
        items[selectedIndex].click()
      } else {
        hide()
      }
      break
    default:
  }
}

function withItemProps(children, selectedIndex, select, hide) {
  let index = -1
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child) || child.type !== MenuItem) {
      return child
    }
    index += 1
    const itemIndex = index
    return React.cloneElement(child, {
      selected: selectedIndex === itemIndex,
      onMouseMove: () => select(itemIndex),
      onMouseLeave: () => select(null),
      onPicked: hide
    })
  })
}

function pointerAt(event) {
  return {
    x: event.clientX || (event.touches && event.touches[0].pageX),
    y: event.clientY || (event.touches && event.touches[0].pageY)
  }
}

export function ContextMenu({ id, children }) {
  const menu = useRef(null)
  const [place, setPlace] = useState({ isVisible: false, x: 0, y: 0 })
  const { isVisible } = place
  const [selectedIndex, setSelectedIndex] = useState(null)
  // For the key listener, which is added once while the menu is open.
  const selected = useRef(null)
  selected.current = selectedIndex

  const show = useCallback((x, y) => {
    setPlace({ isVisible: true, x, y })
    setSelectedIndex(null)
  }, [])

  const hide = useCallback(() => {
    setPlace((current) => (current.isVisible ? { ...current, isVisible: false } : current))
    setSelectedIndex(null)
  }, [])

  useEffect(() => {
    const handle = { id, show, hide }
    menus.add(handle)
    return () => menus.delete(handle)
  }, [id, show, hide])

  useLayoutEffect(() => placeMenu(menu.current, place))

  useEffect(() => {
    if (!isVisible) {
      return undefined
    }
    const onOutsidePress = (event) => {
      if (!menu.current.contains(event.target)) {
        hide()
      }
    }
    /* React answers a right click before this listener sees it, so by now a click that a trigger
    handled has had its default prevented, and the menu it opened stays open. */
    const onOtherContextMenu = (event) => {
      if (!event.defaultPrevented) {
        hide()
      }
    }
    const onKeyDown = (event) => {
      onMenuKey(event, menu.current.getElementsByClassName(ITEM_CLASS), selected.current, setSelectedIndex, hide)
    }
    return listen([
      [document, 'mousedown', onOutsidePress],
      [document, 'touchstart', onOutsidePress],
      [document, 'scroll', hide],
      [document, 'contextmenu', onOtherContextMenu],
      [document, 'keydown', onKeyDown],
      [window, 'resize', hide]
    ])
  }, [isVisible, hide])

  const onContextMenu = (event) => {
    event.preventDefault()
    hide()
  }

  return (
    <nav
      role='menu'
      tabIndex='-1'
      ref={menu}
      style={{ position: 'fixed', zIndex: Z_INDEX, opacity: 0, pointerEvents: 'none' }}
      className={classNames('react-contextmenu', { 'react-contextmenu--visible': isVisible })}
      onContextMenu={onContextMenu}
    >
      {withItemProps(children, selectedIndex, setSelectedIndex, hide)}
    </nav>
  )
}

// action becomes data-action, for the deployment's sheet to give the item an icon.
export function MenuItem({ children, action, onClick, selected, onMouseMove, onMouseLeave, onPicked }) {
  const handleClick = (event) => {
    event.preventDefault()
    if (onClick) {
      onClick(event)
    }
    if (onPicked) {
      onPicked()
    }
  }
  return (
    <div
      className={classNames(ITEM_CLASS, { 'react-contextmenu-item--selected': selected })}
      role='menuitem'
      tabIndex='-1'
      data-action={action}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchEnd={handleClick}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}

export function ContextMenuTrigger({ id, children }) {
  const holdTimer = useRef(null)
  const heldOpen = useRef(false)

  const cancelHold = () => clearTimeout(holdTimer.current)

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  const open = (event) => {
    event.preventDefault()
    const { x, y } = pointerAt(event)
    showMenu(id, x, y)
  }

  const hold = (event) => {
    cancelHold()
    holdTimer.current = setTimeout(() => {
      heldOpen.current = true
      open(event)
    }, HOLD_TO_DISPLAY_MS)
  }

  const onMouseDown = (event) => {
    if (event.button === 0) {
      hold(event)
    }
  }

  const onMouseUp = (event) => {
    if (event.button === 0) {
      cancelHold()
    }
  }

  const onTouchStart = (event) => {
    heldOpen.current = false
    hold(event)
  }

  // A finger lifted after the menu opened would otherwise go on to click the row under it.
  const onTouchEnd = (event) => {
    if (heldOpen.current) {
      event.preventDefault()
    }
    cancelHold()
  }

  return (
    <div
      className='react-contextmenu-wrapper'
      onContextMenu={open}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseOut={cancelHold}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  )
}
