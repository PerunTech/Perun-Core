import React, { useContext, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import classNames from 'classnames';
import { IntlContext } from 'react-intl';
import { labelBasePath } from '../../../config';

/* A dropdown that narrows its options to what is typed in it, holding one value or several, standing
in for react-select 1.2.1. The markup and class names are react-select's (`Select`, `Select-control`,
`Select-multi-value-wrapper`, `Select-value`, `Select-input`, `Select-menu-outer`, `Select-option`,
the `is-focused`/`is-open`/`has-value` states, ...), down to which element carries which and how
they nest, since the deployments' sheets style it by them, some through the nesting itself
(`.custom-select-dropdown>div>div`, `span[class=Select-multi-value-wrapper]`). Its look is the
assets' perun-select.css; here it only sizes its text input, as react-select did inline, and places
its menu (see placeMenu).

Its props are the part of react-select's that perun-core used, with react-select's defaults:
`options` (`{ value, label }`), `value`, `onChange`, `multi`, `simpleValue`, `clearable`,
`escapeClearsValue`, `removeSelected`, `autosize`, `placeholder`, `noResultsText`, `className`,
`optionClassName`, `style` (on the control), `name` (a hidden input per value) and `required`,
plus `aria-label` and `aria-labelledby` for its text input. A value is read as react-select read it:
an option, a value of one, or for `multi` an array of either or a comma separated string of values.
`onChange` is given the option picked, or null when cleared; for `multi` the options picked, an
empty array when cleared; and with `simpleValue` their values instead, comma separated for `multi`.

The keys are react-select's: Up, Down, Page Up, Page Down, Home and End move through the options
and open the menu when it is closed, Enter and Tab pick the option moved to, Escape closes the menu
and, when it is closed, clears the value, and Backspace or Delete in an empty text removes the last
value. Where it differs from react-select:
- An option matches when every word typed is part of its label, in any order, ignoring case and
  the accents of Latin letters. react-select matched the whole text as typed, in the value too.
- Backspace leaves a value it cannot clear (`clearable={false}`); react-select cleared it to null.
- Tab with no option in the menu moves on; react-select kept the focus.
- No box round it cuts its menu off, and the menu opens above it when it fits there and not below;
  react-select's hung below it inside such a box, and scrolled the window down to it.
- Its text input is a combobox as ARIA 1.2 describes one, owning the listbox it opens.
- Its texts are labels (perun.main.select.*), with react-select's English while they have none. */

const DELIMITER = ','
const PAGE_SIZE = 5
const NO_OPTIONS = []
const INITIAL_STATE = { inputValue: '', isFocused: false, isOpen: false, isPseudoFocused: false, focusedOption: null }

// react-select's English, for the labels nothing has given a text yet.
const TEXTS = {
  placeholder: 'Select...',
  no_results: 'No results found',
  clear_value: 'Clear value',
  clear_all: 'Clear all',
  backspace_to_remove: 'Press backspace to remove {label}'
}

// Read without useIntl, so that it also draws outside the intl provider.
function text(intl, code, values) {
  const defaultMessage = TEXTS[code]
  if (!intl) {
    return values ? defaultMessage.replace('{label}', values.label) : defaultMessage
  }
  return intl.formatMessage({ id: `${labelBasePath}.main.select.${code}`, defaultMessage }, values)
}

// An update merges into the state; a function of the state may return null to leave it as it is.
function mergeState(state, update) {
  const changes = typeof update === 'function' ? update(state) : update
  return changes ? { ...state, ...changes } : state
}

// Lower case, with the accents of Latin letters taken off (é is e) and other scripts' letters left whole (й is not и).
function fold(label) {
  return String(label).normalize('NFD').replace(/([A-Za-z])[̀-ͯ]+/g, '$1').normalize('NFC').toLowerCase()
}

// The options whose labels hold every word of the text, less the values in `excluded`.
function matchOptions(options, foldedLabels, inputValue, excluded) {
  const words = fold(inputValue).split(/\s+/).filter((word) => word.length > 0)
  return options.filter((option, i) => !(excluded && excluded.has(option.value)) &&
    words.every((word) => foldedLabels[i].includes(word)))
}

// The option a plain value names, compared as text, as react-select's expandValue did; an option is itself.
function expandValue(value, options) {
  const type = typeof value
  if (type !== 'string' && type !== 'number' && type !== 'boolean') {
    return value
  }
  return options.find((option) => String(option.value) === String(value))
}

// The options a value holds, as react-select's getValueArray read them.
function selectedOptions(value, options, multi) {
  if (multi) {
    let values = typeof value === 'string' ? value.split(DELIMITER) : value
    if (!Array.isArray(values)) {
      values = values === null || values === undefined ? [] : [values]
    }
    return values.map((item) => expandValue(item, options)).filter(Boolean)
  }
  const option = expandValue(value, options)
  return option ? [option] : []
}

// The option the menu shows as moved to: `option` when it is in the menu, else the first.
function focusableIndex(visible, option) {
  if (!visible.length) {
    return null
  }
  if (option) {
    const index = visible.findIndex((candidate) => candidate.value === option.value)
    if (index !== -1) {
      return index
    }
  }
  return 0
}

function stringifyValue(value) {
  return typeof value === 'string' ? value : (value !== null && JSON.stringify(value)) || ''
}

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

// Hidden, measuring the text so that the input is as wide as what it holds, as react-input-autosize did.
const SIZER_STYLE = { position: 'absolute', top: 0, left: 0, visibility: 'hidden', height: 0, overflow: 'scroll', whiteSpace: 'pre' }
const SIZER_FONT = ['fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform']
const MIN_INPUT_WIDTH = 5

/* The text input sized to its text, at least 5px wide, in react-input-autosize's markup: a
`Select-input` holding the input and the hidden copy of its text it measures. The copy takes the
input's font when it mounts, as react-input-autosize's did. */
function AutosizeInput({ inputRef, ...inputProps }) {
  const sizerRef = useRef(null)
  const [width, setWidth] = useState(MIN_INPUT_WIDTH)

  useLayoutEffect(() => {
    const styles = window.getComputedStyle(inputRef.current)
    SIZER_FONT.forEach((property) => {
      sizerRef.current.style[property] = styles[property]
    })
  }, [inputRef])

  useLayoutEffect(() => {
    setWidth(Math.max(sizerRef.current.scrollWidth + 2, MIN_INPUT_WIDTH))
  }, [inputProps.value])

  return (
    <div className='Select-input' style={{ display: 'inline-block' }}>
      <input {...inputProps} ref={inputRef} style={{ boxSizing: 'content-box', width: `${width}px` }} />
      <div ref={sizerRef} style={SIZER_STYLE}>{inputProps.value}</div>
    </div>
  )
}

export default function Select({
  options = NO_OPTIONS,
  value,
  onChange,
  multi = false,
  simpleValue = false,
  clearable = true,
  escapeClearsValue = true,
  removeSelected = true,
  autosize = true,
  placeholder,
  noResultsText,
  className,
  optionClassName,
  style,
  name,
  required = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy
}) {
  const intl = useContext(IntlContext)
  const prefix = `perun-select-${useId()}`
  const [state, setState] = useReducer(mergeState, INITIAL_STATE)
  const { inputValue, isFocused, isOpen, isPseudoFocused, focusedOption } = state
  const wrapperRef = useRef(null)
  const controlRef = useRef(null)
  const inputRef = useRef(null)
  const menuOuterRef = useRef(null)
  const menuRef = useRef(null)
  // A press that focuses the input opens the menu, as the focus that follows it would not.
  const openAfterFocus = useRef(false)
  // The control's own press handler leaves alone a press its clear button already answered.
  const clearPressed = useRef(false)
  // The option moved to is scrolled into view once each time the menu opens, and after each key.
  const scrolledToOption = useRef(false)
  const scrollToFocused = useRef(false)

  const list = Array.isArray(options) ? options : NO_OPTIONS
  const foldedLabels = useMemo(() => list.map((option) => fold(option.label ?? '')), [list])
  const values = selectedOptions(value, list, multi)
  const excluded = multi && removeSelected ? new Set(values.map((option) => option.value)) : null
  const visible = matchOptions(list, foldedLabels, inputValue, excluded)
  // A multi-select with every option picked has nothing to open.
  const open = isOpen && !(multi && !visible.length && values.length > 0 && !inputValue)
  const focusedIndex = focusableIndex(visible, focusedOption || values[0])
  const focused = focusedIndex === null ? null : visible[focusedIndex]
  const listId = `${prefix}-list`
  const messageId = `${prefix}-backspace-remove-message`
  const optionId = (index) => `${prefix}-option-${index}`

  // A value changed from outside while something was typed takes the text away, as in react-select.
  const shownValue = useRef(value)
  useEffect(() => {
    if (shownValue.current !== value) {
      shownValue.current = value
      setState((current) => (current.inputValue ? { inputValue: '' } : null))
    }
  }, [value])

  // A touch outside closes the menu, for the touch screens on which it leaves the input focused.
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const onTouchStart = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setState((current) => ({ inputValue: '', isOpen: false, isPseudoFocused: current.isFocused && !multi }))
      }
    }
    document.addEventListener('touchstart', onTouchStart)
    return () => document.removeEventListener('touchstart', onTouchStart)
  }, [open, multi])

  // The menu is placed at the control, and the option moved to kept in view in it, as in react-select.
  useLayoutEffect(() => {
    if (open) {
      placeMenu(controlRef.current, menuOuterRef.current, menuRef.current)
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

  // And placed again when something round it scrolls, or the window changes size.
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const place = () => placeMenu(controlRef.current, menuOuterRef.current, menuRef.current)
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

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const setValue = (next) => {
    if (!onChange) {
      return
    }
    if (simpleValue && next) {
      onChange(multi ? next.map((option) => option.value).join(DELIMITER) : next.value)
    } else {
      onChange(next)
    }
  }

  const closeMenu = () => {
    setState({ inputValue: '', isOpen: false, isPseudoFocused: isFocused && !multi })
    scrolledToOption.current = false
  }

  const removeValue = (option) => {
    setValue(values.filter((picked) => picked.value !== option.value))
    focusInput()
  }

  // The menu moves on to the option after the one picked, or to the one before it when it was last.
  const addValue = (option) => {
    const remaining = matchOptions(list, foldedLabels, '', excluded)
    const index = remaining.indexOf(option)
    setValue(values.concat(option))
    if (index === remaining.length - 1) {
      setState({ focusedOption: remaining[index - 1] || null })
    } else if (index !== -1) {
      setState({ focusedOption: remaining[index + 1] })
    }
  }

  const selectValue = (option) => {
    scrolledToOption.current = false
    if (multi) {
      setState({ inputValue: '', isOpen: false })
      if (values.some((picked) => picked.value === option.value)) {
        removeValue(option)
      } else {
        addValue(option)
      }
    } else {
      setState({ inputValue: '', isOpen: false, isPseudoFocused: isFocused })
      setValue(option)
    }
  }

  const popValue = () => {
    if (!values.length) {
      return
    }
    if (multi) {
      setValue(values.slice(0, -1))
    } else if (clearable) {
      setValue(null)
    }
  }

  const clearValue = () => {
    setValue(multi ? [] : null)
    setState({ inputValue: '', isOpen: false })
    focusInput()
  }

  const focusAdjacentOption = (direction) => {
    scrollToFocused.current = true
    if (!isOpen) {
      const first = visible.length ? visible[direction === 'next' ? 0 : visible.length - 1] : null
      setState({ focusedOption: focused || first, isOpen: true, inputValue: '' })
      return
    }
    if (!visible.length) {
      return
    }
    const last = visible.length - 1
    let index = focusedIndex
    switch (direction) {
      case 'next':
        index = (index + 1) % visible.length
        break
      case 'previous':
        index = index > 0 ? index - 1 : last
        break
      case 'start':
        index = 0
        break
      case 'end':
        index = last
        break
      case 'page_up':
        index = Math.max(index - PAGE_SIZE, 0)
        break
      case 'page_down':
        index = Math.min(index + PAGE_SIZE, last)
        break
    }
    setState({ focusedOption: visible[index] })
  }

  const onKeyDown = (event) => {
    if (event.nativeEvent.isComposing) {
      return
    }
    switch (event.key) {
      case 'Backspace':
      case 'Delete':
        if (!inputValue) {
          event.preventDefault()
          popValue()
        }
        break
      case 'Tab':
        if (event.shiftKey || !open || !focused) {
          break
        }
        event.preventDefault()
        selectValue(focused)
        break
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        if (!open) {
          focusAdjacentOption('next')
        } else if (focused) {
          selectValue(focused)
        }
        break
      case 'Escape':
        event.preventDefault()
        if (open) {
          closeMenu()
          event.stopPropagation()
        } else if (clearable && escapeClearsValue) {
          clearValue()
          event.stopPropagation()
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAdjacentOption('previous')
        break
      case 'ArrowDown':
        event.preventDefault()
        focusAdjacentOption('next')
        break
      case 'PageUp':
        event.preventDefault()
        focusAdjacentOption('page_up')
        break
      case 'PageDown':
        event.preventDefault()
        focusAdjacentOption('page_down')
        break
      case 'End':
        if (!event.shiftKey) {
          event.preventDefault()
          focusAdjacentOption('end')
        }
        break
      case 'Home':
        if (!event.shiftKey) {
          event.preventDefault()
          focusAdjacentOption('start')
        }
        break
    }
  }

  /* A press on the control focuses the input and opens the menu. One on the input itself is left
  to place the caret; anywhere else the focus is kept in the input. */
  const onControlMouseDown = (event) => {
    if (event.button !== 0) {
      return
    }
    if (clearPressed.current) {
      clearPressed.current = false
      return
    }
    if (event.target === inputRef.current) {
      if (!isFocused) {
        openAfterFocus.current = true
        focusInput()
      } else if (!isOpen) {
        setState({ isOpen: true, isPseudoFocused: false })
      }
      return
    }
    event.preventDefault()
    if (isFocused) {
      focusInput()
      // Emptied here and filled again by the render, which leaves the caret after the text.
      inputRef.current.value = ''
      setState({ isOpen: true, isPseudoFocused: false, focusedOption: null })
    } else {
      openAfterFocus.current = true
      focusInput()
      setState({ focusedOption: null })
    }
  }

  const onArrowMouseDown = (event) => {
    if (event.button !== 0) {
      return
    }
    if (isOpen) {
      event.stopPropagation()
      event.preventDefault()
      closeMenu()
    } else {
      setState({ isOpen: true })
    }
  }

  const onClearMouseDown = (event) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    clearPressed.current = true
    setState({ isPseudoFocused: false, focusedOption: null })
    clearValue()
  }

  const onMenuMouseDown = (event) => {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    event.preventDefault()
    openAfterFocus.current = true
    focusInput()
  }

  const onOptionMouseDown = (event, option) => {
    event.preventDefault()
    event.stopPropagation()
    selectValue(option)
  }

  const onOptionHover = (option) => {
    if (option !== focused) {
      setState({ focusedOption: option })
    }
  }

  const onRemoveMouseDown = (event, option) => {
    event.preventDefault()
    event.stopPropagation()
    removeValue(option)
  }

  const onInputFocus = () => {
    setState({ isFocused: true, isOpen: Boolean(isOpen || openAfterFocus.current) })
    openAfterFocus.current = false
  }

  const onInputBlur = (event) => {
    if (menuRef.current && event.relatedTarget && menuRef.current.contains(event.relatedTarget)) {
      focusInput()
      return
    }
    setState({ isFocused: false, isOpen: false, isPseudoFocused: false, inputValue: '' })
  }

  const onInputChange = (event) => {
    setState({ inputValue: event.target.value, isOpen: true, isPseudoFocused: false })
  }

  const renderValue = () => {
    if (!values.length) {
      return inputValue ? null : <div className='Select-placeholder'>{placeholder ?? text(intl, 'placeholder')}</div>
    }
    if (multi) {
      return values.map((option, i) => (
        <div key={`value-${i}-${option.value}`} className={classNames('Select-value', option.className)} style={option.style} title={option.title}>
          <span className='Select-value-icon' aria-hidden='true' onMouseDown={(event) => onRemoveMouseDown(event, option)}>{'×'}</span>
          <span className='Select-value-label' id={`${prefix}-value-${i}`}>
            {option.label}
            <span className='Select-aria-only'>{' '}</span>
          </span>
        </div>
      ))
    }
    if (inputValue) {
      return null
    }
    const option = values[0]
    return (
      <div className={classNames('Select-value', option.className)} style={option.style} title={option.title}>
        <span className='Select-value-label' id={`${prefix}-value-item`}>{option.label}</span>
      </div>
    )
  }

  const showRemoveMessage = multi && values.length > 0 && !inputValue && isFocused
  const inputProps = {
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open && focused ? optionId(focusedIndex) : undefined,
    'aria-describedby': showRemoveMessage ? messageId : undefined,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    required: required && !values.length,
    value: inputValue,
    onBlur: onInputBlur,
    onChange: onInputChange,
    onFocus: onInputFocus
  }

  // Without autosize the input carries `Select-input` as well as the element around it, as in react-select.
  const input = autosize
    ? <AutosizeInput inputRef={inputRef} {...inputProps} />
    : (
      <div className='Select-input' style={{ display: 'inline-block' }}>
        <input {...inputProps} ref={inputRef} className='Select-input' />
      </div>
    )

  const clearText = clearable && values.length > 0 ? text(intl, multi ? 'clear_all' : 'clear_value') : null

  return (
    <div
      ref={wrapperRef}
      className={classNames('Select', className, {
        'has-value': values.length > 0,
        'is-clearable': clearable,
        'is-focused': isFocused,
        'is-open': open,
        'is-pseudo-focused': isPseudoFocused,
        'is-searchable': true,
        'Select--multi': multi,
        'Select--single': !multi
      })}
    >
      {name && values.map((option, i) => (
        <input key={`hidden.${i}`} name={name} type='hidden' value={stringifyValue(option.value)} />
      ))}
      <div ref={controlRef} className='Select-control' style={style} onKeyDown={onKeyDown} onMouseDown={onControlMouseDown}>
        <span className='Select-multi-value-wrapper' id={`${prefix}-value`}>
          {renderValue()}
          {input}
        </span>
        {showRemoveMessage && (
          <span id={messageId} className='Select-aria-only' aria-live='assertive'>
            {text(intl, 'backspace_to_remove', { label: values[values.length - 1].label })}
          </span>
        )}
        {clearText && (
          <span aria-label={clearText} className='Select-clear-zone' title={clearText} onMouseDown={onClearMouseDown}>
            <span className='Select-clear'>{'×'}</span>
          </span>
        )}
        <span className='Select-arrow-zone' onMouseDown={onArrowMouseDown}>
          <span className='Select-arrow' />
        </span>
      </div>
      {open && (
        <div ref={menuOuterRef} className='Select-menu-outer'>
          <div
            ref={menuRef}
            className='Select-menu'
            id={listId}
            role='listbox'
            aria-multiselectable={multi || undefined}
            tabIndex={-1}
            onMouseDown={onMenuMouseDown}
          >
            {visible.length ? visible.map((option, i) => {
              const isSelected = values.some((picked) => picked.value === option.value)
              return (
                <div
                  key={`option-${i}-${option.value}`}
                  id={optionId(i)}
                  className={classNames(optionClassName, { 'Select-option': true, 'is-selected': isSelected, 'is-focused': i === focusedIndex })}
                  style={option.style}
                  title={option.title}
                  role='option'
                  aria-selected={isSelected}
                  onMouseDown={(event) => onOptionMouseDown(event, option)}
                  onMouseEnter={() => onOptionHover(option)}
                  onMouseMove={() => onOptionHover(option)}
                >
                  {option.label}
                </div>
              )
            }) : <div className='Select-noresults'>{noResultsText ?? text(intl, 'no_results')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
