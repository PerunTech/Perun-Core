import React from 'react';
import classNames from 'classnames';

/* The grid's right-click menu: a menu, its items, and the trigger that opens it, standing in for
the react-contextmenu copy that react-data-grid-addons carried. The markup and class names are
react-contextmenu's (`react-contextmenu`, `react-contextmenu--visible`, `react-contextmenu-item`,
`react-contextmenu-item--selected`, `react-contextmenu-wrapper`), since the deployments' sheets
style the menu by them, and react-data-grid's own sheet raises `react-contextmenu--visible` above
the grid.

A trigger names its menu by id. A right click on the trigger, or holding a mouse button or a finger
on it for a second, opens that menu at the pointer and closes any other. The menu closes on a press
outside it, on a page scroll, on a resize, on a right click that no trigger answered, and on
Escape. Up and Down move through the items and Enter picks one, as in react-contextmenu. Submenus,
dividers and the `collect`/`data` hand-off it also had are left out: the grid uses none of them. */

const HOLD_TO_DISPLAY_MS = 1000
const ITEM_CLASS = 'react-contextmenu-item'

const menus = new Set()

function showMenu(id, x, y) {
  menus.forEach((menu) => (menu.props.id === id ? menu.show(x, y) : menu.hide()))
}

export class ContextMenu extends React.Component {
  constructor(props) {
    super(props)
    this.state = { isVisible: false, x: 0, y: 0, selectedIndex: null }
  }

  componentDidMount() {
    menus.add(this)
  }

  /* Placed once it has rendered, when its size is known, and shown by style rather than by a
  re-render, as react-contextmenu did. */
  componentDidUpdate() {
    if (!this.menu) {
      return
    }
    if (this.state.isVisible) {
      const { top, left } = this.getPosition()
      this.menu.style.top = `${top}px`
      this.menu.style.left = `${left}px`
      this.menu.style.opacity = 1
      this.menu.style.pointerEvents = 'auto'
    } else {
      this.menu.style.opacity = 0
      this.menu.style.pointerEvents = 'none'
    }
  }

  componentWillUnmount() {
    menus.delete(this)
    this.removeListeners()
  }

  show(x, y) {
    this.setState({ isVisible: true, x, y, selectedIndex: null })
    this.addListeners()
  }

  hide = () => {
    if (this.state.isVisible) {
      this.removeListeners()
      this.setState({ isVisible: false, selectedIndex: null })
    }
  }

  addListeners() {
    document.addEventListener('mousedown', this.onOutsidePress)
    document.addEventListener('touchstart', this.onOutsidePress)
    document.addEventListener('scroll', this.hide)
    document.addEventListener('contextmenu', this.onOtherContextMenu)
    document.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('resize', this.hide)
  }

  removeListeners() {
    document.removeEventListener('mousedown', this.onOutsidePress)
    document.removeEventListener('touchstart', this.onOutsidePress)
    document.removeEventListener('scroll', this.hide)
    document.removeEventListener('contextmenu', this.onOtherContextMenu)
    document.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('resize', this.hide)
  }

  onOutsidePress = (event) => {
    if (this.menu && !this.menu.contains(event.target)) {
      this.hide()
    }
  }

  /* React answers a right click before this listener sees it, so by now a click that a trigger
  handled has had its default prevented, and the menu it opened stays open. */
  onOtherContextMenu = (event) => {
    if (!event.defaultPrevented) {
      this.hide()
    }
  }

  onKeyDown = (event) => {
    const items = this.menu ? this.menu.getElementsByClassName(ITEM_CLASS) : []
    const last = items.length - 1
    const { selectedIndex } = this.state
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        this.hide()
        break
      case 'ArrowUp':
        event.preventDefault()
        if (last >= 0) {
          this.setState({ selectedIndex: selectedIndex === null || selectedIndex === 0 ? last : selectedIndex - 1 })
        }
        break
      case 'ArrowDown':
        event.preventDefault()
        if (last >= 0) {
          this.setState({ selectedIndex: selectedIndex === null || selectedIndex === last ? 0 : selectedIndex + 1 })
        }
        break
      case 'Enter':
        event.preventDefault()
        if (selectedIndex !== null && items[selectedIndex]) {
          items[selectedIndex].click()
        } else {
          this.hide()
        }
        break
      default:
    }
  }

  /* At the pointer, moved back by its own size where it would run past the right or bottom edge
  of the window, and centred where even that does not fit. */
  getPosition() {
    const { x, y } = this.state
    const { innerWidth, innerHeight } = window
    const rect = this.menu.getBoundingClientRect()
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

  onContextMenu = (event) => {
    event.preventDefault()
    this.hide()
  }

  renderItems() {
    let index = -1
    return React.Children.map(this.props.children, (child) => {
      if (!React.isValidElement(child) || child.type !== MenuItem) {
        return child
      }
      index += 1
      const itemIndex = index
      return React.cloneElement(child, {
        selected: this.state.selectedIndex === itemIndex,
        onMouseMove: () => {
          if (this.state.selectedIndex !== itemIndex) {
            this.setState({ selectedIndex: itemIndex })
          }
        },
        onMouseLeave: () => this.setState({ selectedIndex: null }),
        onPicked: this.hide
      })
    })
  }

  render() {
    return (
      <nav
        role='menu'
        tabIndex='-1'
        ref={(node) => { this.menu = node }}
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}
        className={classNames('react-contextmenu', { 'react-contextmenu--visible': this.state.isVisible })}
        onContextMenu={this.onContextMenu}
      >
        {this.renderItems()}
      </nav>
    )
  }
}

/* `onClick` is called with the click event, after which the menu closes. The rest of the props are
the menu's to set. */
export function MenuItem({ children, onClick, selected, onMouseMove, onMouseLeave, onPicked }) {
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
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchEnd={handleClick}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}

/* Wraps what a right click should open the menu `id` on. react-data-grid renders it around the
grid's rows as the `RowsContainer`, passing it the id of the element given as its `contextMenu`. */
export class ContextMenuTrigger extends React.Component {
  componentWillUnmount() {
    this.cancelHold()
  }

  open = (event) => {
    event.preventDefault()
    const x = event.clientX || (event.touches && event.touches[0].pageX)
    const y = event.clientY || (event.touches && event.touches[0].pageY)
    showMenu(this.props.id, x, y)
  }

  hold = (event) => {
    event.persist()
    this.cancelHold()
    this.holdTimer = setTimeout(() => {
      this.heldOpen = true
      this.open(event)
    }, HOLD_TO_DISPLAY_MS)
  }

  cancelHold = () => {
    clearTimeout(this.holdTimer)
  }

  onMouseDown = (event) => {
    if (event.button === 0) {
      this.hold(event)
    }
  }

  onMouseUp = (event) => {
    if (event.button === 0) {
      this.cancelHold()
    }
  }

  onTouchStart = (event) => {
    this.heldOpen = false
    this.hold(event)
  }

  // A finger lifted after the menu opened would otherwise go on to click the row under it.
  onTouchEnd = (event) => {
    if (this.heldOpen) {
      event.preventDefault()
    }
    this.cancelHold()
  }

  render() {
    return (
      <div
        className='react-contextmenu-wrapper'
        onContextMenu={this.open}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onMouseOut={this.cancelHold}
        onTouchStart={this.onTouchStart}
        onTouchEnd={this.onTouchEnd}
      >
        {this.props.children}
      </div>
    )
  }
}
