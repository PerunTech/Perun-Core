import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { IntlContext } from 'react-intl';
import { text } from './labels';

/* What the Select draws, part by part, in react-select's markup: the values it holds, its text
input, and its menu. */

/* The values: for `multi` each option picked, with the × that removes it, and otherwise the one
picked, unless something is typed in its place. The placeholder when there is none. */
export function Values({ values, multi, inputValue, placeholder, prefix, onRemoveMouseDown }) {
  const intl = useContext(IntlContext)
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

// The text input; without `autosize` it carries `Select-input` as well as the element around it, as in react-select.
export function Input({ autosize, inputRef, ...inputProps }) {
  if (autosize) {
    return <AutosizeInput inputRef={inputRef} {...inputProps} />
  }
  return (
    <div className='Select-input' style={{ display: 'inline-block' }}>
      <input {...inputProps} ref={inputRef} className='Select-input' />
    </div>
  )
}

/* The menu: a listbox of the options shown (`visible`), the one at `focusedIndex` marked as moved
to and the ones among `values` as picked, or the text saying nothing matches. The refs are the
menu's (`outerRef`) and its scrolling list's (`menuRef`); `optionId(index)` is an option's id.
With a `virtualizer` (see useMenu) only the options it lists are drawn, each placed at its offset
in a box as high as the whole list, telling its place in the list, since the rest are not there. */
export function Menu({
  outerRef, menuRef, listId, optionId, multi, visible, values, focusedIndex, optionClassName, noResultsText,
  virtualizer, onMouseDown, onOptionMouseDown, onOptionHover
}) {
  const intl = useContext(IntlContext)
  const picked = new Set(values.map((option) => option.value))

  // An option, at `item` in the virtual list when there is one.
  const renderOption = (option, i, item) => {
    const isSelected = picked.has(option.value)
    return (
      <div
        key={`option-${i}-${option.value}`}
        ref={item ? virtualizer.measureElement : undefined}
        id={optionId(i)}
        className={classNames(optionClassName, { 'Select-option': true, 'is-selected': isSelected, 'is-focused': i === focusedIndex })}
        style={item ? { ...option.style, position: 'absolute', top: item.start, left: 0, right: 0 } : option.style}
        title={option.title}
        role='option'
        aria-selected={isSelected}
        aria-setsize={item ? visible.length : undefined}
        aria-posinset={item ? i + 1 : undefined}
        data-index={item ? i : undefined}
        onMouseDown={(event) => onOptionMouseDown(event, option)}
        onMouseEnter={() => onOptionHover(option)}
        onMouseMove={() => onOptionHover(option)}
      >
        {option.label}
      </div>
    )
  }

  let options
  if (!visible.length) {
    options = <div className='Select-noresults'>{noResultsText ?? text(intl, 'no_results')}</div>
  } else if (virtualizer) {
    options = (
      <div role='presentation' style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => renderOption(visible[item.index], item.index, item))}
      </div>
    )
  } else {
    options = visible.map((option, i) => renderOption(option, i))
  }

  return (
    <div ref={outerRef} className='Select-menu-outer'>
      <div
        ref={menuRef}
        className='Select-menu'
        id={listId}
        role='listbox'
        aria-multiselectable={multi || undefined}
        tabIndex={-1}
        onMouseDown={onMouseDown}
      >
        {options}
      </div>
    </div>
  )
}
