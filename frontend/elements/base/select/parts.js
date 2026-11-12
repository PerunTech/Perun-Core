import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { IntlContext } from 'react-intl';
import { text } from './labels';

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

// Measures the text so the input is as wide as what it holds.
const SIZER_STYLE = { position: 'absolute', top: 0, left: 0, visibility: 'hidden', height: 0, overflow: 'scroll', whiteSpace: 'pre' }
const SIZER_FONT = ['fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform']
const MIN_INPUT_WIDTH = 5

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

// Without autosize the input carries Select-input itself, as in react-select.
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

// With a virtualizer only its options are drawn, each at its offset in a box as high as the whole list.
export function Menu({
  outerRef, menuRef, listId, optionId, multi, visible, values, focusedIndex, optionClassName, noResultsText,
  virtualizer, onMouseDown, onOptionMouseDown, onOptionHover
}) {
  const intl = useContext(IntlContext)
  const picked = new Set(values.map((option) => option.value))

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
