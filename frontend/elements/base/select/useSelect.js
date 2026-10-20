import { useEffect, useMemo, useReducer, useRef } from 'react';
import { DELIMITER, fold, focusableIndex, matchOptions, movedIndex, selectedOptions } from './options';
import useMenu from './useMenu';

const NO_OPTIONS = []
const INITIAL_STATE = { inputValue: '', isFocused: false, isOpen: false, isPseudoFocused: false, focusedOption: null }

// The keys that move through the options, and where to.
const MOVES = { ArrowUp: 'previous', ArrowDown: 'next', PageUp: 'page_up', PageDown: 'page_down', Home: 'start', End: 'end' }

// An update merges into the state; a function of the state may return null to leave it as it is.
function mergeState(state, update) {
  const changes = typeof update === 'function' ? update(state) : update
  return changes ? { ...state, ...changes } : state
}

/**
 * What a Select holds and what changes it: the text typed, whether its input has the focus (or is
 * drawn as if it had, after a pick: `isPseudoFocused`), whether its menu is open and which option is
 * moved to in it, and the calls that pick, remove and clear values, close the menu and answer keys.
 * @param {object} props - The Select's props this reads: `options`, `value`, `onChange`, `multi`,
 *   `simpleValue`, `clearable`, `escapeClearsValue` and `removeSelected`.
 * @returns {object} The state and `setState` (an update merges into it); the refs for the Select
 *   itself (`wrapperRef`), its text input (`inputRef`) and its menu (`menu`, see useMenu); the options
 *   it holds (`values`) and shows in its menu (`visible`), whether the menu is drawn (`open`), the
 *   option moved to (`focused`, at `focusedIndex` in `visible`); and the calls.
 */
export default function useSelect({ options, value, onChange, multi, simpleValue, clearable, escapeClearsValue, removeSelected }) {
  const [state, setState] = useReducer(mergeState, INITIAL_STATE)
  const { inputValue, isFocused, isOpen, focusedOption } = state
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  const list = Array.isArray(options) ? options : NO_OPTIONS
  const foldedLabels = useMemo(() => list.map((option) => fold(option.label ?? '')), [list])
  const values = selectedOptions(value, list, multi)
  const excluded = multi && removeSelected ? new Set(values.map((option) => option.value)) : null
  const visible = matchOptions(list, foldedLabels, inputValue, excluded)
  // A multi-select with every option picked has nothing to open.
  const open = isOpen && !(multi && !visible.length && values.length > 0 && !inputValue)
  const focusedIndex = focusableIndex(visible, focusedOption || values[0])
  const focused = focusedIndex === null ? null : visible[focusedIndex]

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

  const menu = useMenu(open, focusedIndex)

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
    menu.scrollOnOpen()
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
    menu.scrollOnOpen()
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

  // A move on a closed menu only opens it, at the option it shows as moved to.
  const focusAdjacentOption = (direction) => {
    menu.scrollOnMove()
    if (!isOpen) {
      setState({ focusedOption: focused, isOpen: true, inputValue: '' })
    } else if (visible.length) {
      setState({ focusedOption: visible[movedIndex(direction, focusedIndex, visible.length)] })
    }
  }

  const onKeyDown = (event) => {
    if (event.nativeEvent.isComposing) {
      return
    }
    const move = MOVES[event.key]
    if (move) {
      // Shift with Home or End selects the text in the input instead.
      if (!event.shiftKey || (move !== 'start' && move !== 'end')) {
        event.preventDefault()
        focusAdjacentOption(move)
      }
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
    }
  }

  return {
    ...state,
    setState,
    wrapperRef,
    inputRef,
    menu,
    values,
    visible,
    open,
    focused,
    focusedIndex,
    focusInput,
    closeMenu,
    selectValue,
    removeValue,
    clearValue,
    onKeyDown
  }
}
