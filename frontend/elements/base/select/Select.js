import React, { useContext, useId, useRef } from 'react';
import classNames from 'classnames';
import { IntlContext } from 'react-intl';
import { stringifyValue } from './options';
import { text } from './labels';
import useSelect from './useSelect';
import { Input, Menu, Values } from './parts';

/* A searchable dropdown for one value or several, standing in for react-select 1.2.1. It keeps
react-select's markup and class names, since the deployments' sheets style it by them; its look is
the assets' perun-select.css.

Its props are the ones perun-core used of react-select's, with the same defaults. `value` is an
option, an option's value, or for `multi` an array of either or a comma separated string. `onChange`
gets the option picked (null when cleared), for `multi` an array of options, and with `simpleValue`
their values instead.

Unlike react-select, it matches every word typed anywhere in a label, ignoring case and accents, and
its menu is never cut off by a box round it (see useMenu.js). Its texts are the labels
perun.main.select.*. */

export default function Select({
  options,
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
  // Read without useIntl, so that it also draws outside the intl provider.
  const intl = useContext(IntlContext)
  const prefix = `perun-select-${useId()}`
  const {
    inputValue, isFocused, isOpen, isPseudoFocused, setState, wrapperRef, inputRef, menu, values, visible, open,
    focused, focusedIndex, focusInput, closeMenu, selectValue, removeValue, clearValue, onKeyDown
  } = useSelect({ options, value, onChange, multi, simpleValue, clearable, escapeClearsValue, removeSelected })
  // A press that focuses the input opens the menu, as the focus that follows it would not.
  const openAfterFocus = useRef(false)
  // The control's own press handler leaves alone a press its clear button already answered.
  const clearPressed = useRef(false)
  const listId = `${prefix}-list`
  const messageId = `${prefix}-backspace-remove-message`
  const optionId = (index) => `${prefix}-option-${index}`

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
    if (menu.menuRef.current && event.relatedTarget && menu.menuRef.current.contains(event.relatedTarget)) {
      focusInput()
      return
    }
    setState({ isFocused: false, isOpen: false, isPseudoFocused: false, inputValue: '' })
  }

  const onInputChange = (event) => {
    setState({ inputValue: event.target.value, isOpen: true, isPseudoFocused: false })
  }

  const showRemoveMessage = multi && values.length > 0 && !inputValue && isFocused
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
      <div ref={menu.controlRef} className='Select-control' style={style} onKeyDown={onKeyDown} onMouseDown={onControlMouseDown}>
        <span className='Select-multi-value-wrapper' id={`${prefix}-value`}>
          <Values
            values={values}
            multi={multi}
            inputValue={inputValue}
            placeholder={placeholder}
            prefix={prefix}
            onRemoveMouseDown={onRemoveMouseDown}
          />
          <Input
            autosize={autosize}
            inputRef={inputRef}
            role='combobox'
            aria-autocomplete='list'
            aria-haspopup='listbox'
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && focused ? optionId(focusedIndex) : undefined}
            aria-describedby={showRemoveMessage ? messageId : undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            required={required && !values.length}
            value={inputValue}
            onBlur={onInputBlur}
            onChange={onInputChange}
            onFocus={onInputFocus}
          />
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
        <Menu
          outerRef={menu.outerRef}
          menuRef={menu.menuRef}
          listId={listId}
          optionId={optionId}
          multi={multi}
          visible={visible}
          values={values}
          focusedIndex={focusedIndex}
          optionClassName={optionClassName}
          noResultsText={noResultsText}
          onMouseDown={onMenuMouseDown}
          onOptionMouseDown={onOptionMouseDown}
          onOptionHover={onOptionHover}
        />
      )}
    </div>
  )
}
