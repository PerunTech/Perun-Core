import React, { useLayoutEffect, useRef, useState } from 'react';
import TextEditor from './TextEditor';

/* Over the rows and the header, as react-data-grid's editor container sat. */
const Z_INDEX = 10

/* The value an editor starts with: the cell's own, or the character typed on the cell to open it,
which then replaces it. Delete and Backspace start it empty. As react-data-grid did. */
function initialValue(value, firstKey) {
  if (firstKey === 'Delete' || firstKey === 'Backspace') {
    return ''
  }
  return firstKey === undefined || firstKey === 'Enter' ? value : firstKey
}

/* Whether Left or Right would move the caret out of a text box rather than within it. Never for
an element that has no caret, such as a select. */
function caretAtEdge(input, key) {
  if (!input || typeof input.selectionStart !== 'number') {
    return false
  }
  return key === 'ArrowLeft'
    ? input.selectionStart === 0 && input.selectionEnd === 0
    : input.selectionStart === input.value.length
}

/**
 * Edits one cell of the TanStack body, over the cell, with the column's editor, or a TextEditor for
 * an editable column that names none. In the place of react-data-grid's EditorContainer, and with
 * the same contract, so that DropDownEditor and AutoCompleteEditor serve both bodies unchanged.
 *
 * The editor is given `column`, `value`, `rowData`, `height`, `onCommit` and `onCommitCancel` (to
 * end the edit from within, as a click on an autocomplete result does) and `onBlur`. It provides
 * `getInputNode()`, the element that takes the focus and the `editor-main` class, `getValue()`,
 * the change to save as `{ [column.key]: value }`, and optionally `hasResults()`, true while Up and
 * Down move through a list of its own rather than to the next row.
 *
 * Its keys, as in react-data-grid: Enter saves, Escape cancels, Tab and Shift+Tab save and move to
 * the next or previous cell, Up and Down save and move a row, and Left and Right save and move a
 * column once the caret is at that end of the text. Focus leaving the editor saves, and so does
 * anything that takes the editor away before it was saved or cancelled. A scroll of the grid
 * cancels, since the cell moves from under it; any other scroll only moves the editor with the cell.
 *
 * It is placed with `position: fixed` at the cell's place on screen, so that a list it opens is not
 * cut off by the grid's scrolling viewport or the cell, and it stays within the grid's own markup,
 * so that a modal the grid is in keeps the focus inside it.
 *
 * @param {object} column - The column's config.
 * @param {object} row - The row edited.
 * @param {any} value - The cell's value.
 * @param {string} firstKey - The key that opened the editor, or undefined for a double click.
 * @param {Element} viewport - The grid's scrolling element.
 * @param {function} getRect - The cell's `{ top, left, width, height }` on screen.
 * @param {function} onCommit - `(updated, event, hadFocus)`: the change to save, the key that saved
 *   it (undefined when it was not a key), and whether the focus was in the editor.
 * @param {function} onCancel - `(hadFocus)`.
 */
export default function CellEditor({ column, row, value, firstKey, viewport, getRect, onCommit, onCancel }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const settled = useRef(false)
  const [rect, setRect] = useState(getRect)
  const [startValue] = useState(() => initialValue(value, firstKey))
  // The latest of what the listeners below call, since they are added once.
  const latest = useRef(null)
  latest.current = { getRect, onCommit, onCancel }

  const hasFocus = () => Boolean(containerRef.current) && containerRef.current.contains(document.activeElement)

  const commit = (event) => {
    if (!settled.current) {
      settled.current = true
      latest.current.onCommit(editorRef.current.getValue(), event, hasFocus())
    }
  }

  const cancel = () => {
    if (!settled.current) {
      settled.current = true
      latest.current.onCancel(hasFocus())
    }
  }

  // The latest commit, for the clean-up below, which runs before the editor's ref is let go.
  const commitRef = useRef(commit)
  commitRef.current = commit

  useLayoutEffect(() => {
    const input = editorRef.current.getInputNode()
    if (input) {
      input.classList.add('editor-main')
      input.style.height = `${containerRef.current.clientHeight - 1}px`
      input.focus()
      if (input.tagName === 'INPUT') {
        input.select()
      }
    }
    return () => commitRef.current()
  }, [])

  useLayoutEffect(() => {
    // A scroll of the viewport that was under way before the editor opened is not one of the cell's.
    const opened = { top: viewport.scrollTop, left: viewport.scrollLeft }
    const onScroll = (event) => {
      if (event.target === viewport) {
        if (viewport.scrollTop !== opened.top || viewport.scrollLeft !== opened.left) {
          cancel()
        }
      } else if (!(event.target instanceof Node && containerRef.current.contains(event.target))) {
        setRect(latest.current.getRect())
      }
    }
    const onResize = () => setRect(latest.current.getRect())
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [viewport])

  const handleKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey) {
      return
    }
    // What the editor keeps to itself: typing, a list's Up and Down, the caret's Left and Right.
    const editor = editorRef.current
    switch (event.key) {
      case 'Enter':
        // Saved here, and kept from a form the grid may be in.
        event.preventDefault()
        break
      case 'Tab':
        break
      case 'Escape':
        // Kept from a modal the grid may be in, which would close on it as well.
        event.stopPropagation()
        cancel()
        return
      case 'ArrowUp':
      case 'ArrowDown':
        if (typeof editor.hasResults === 'function' && editor.hasResults()) {
          event.stopPropagation()
          return
        }
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        if (!caretAtEdge(editor.getInputNode(), event.key)) {
          event.stopPropagation()
          return
        }
        break
      default:
        event.stopPropagation()
        return
    }
    event.stopPropagation()
    commit(event)
  }

  // Focus moving to another part of the editor, as it does on a click in its list, is not leaving it.
  const handleBlur = (event) => {
    if (!(event.relatedTarget instanceof Node && containerRef.current.contains(event.relatedTarget))) {
      commit()
    }
  }

  const editorProps = {
    ref: editorRef,
    column,
    value: startValue,
    rowData: row,
    height: rect.height,
    onCommit: () => commit(),
    onCommitCancel: cancel,
    onBlur: () => commit()
  }
  const { editor } = column
  let element
  if (React.isValidElement(editor)) {
    element = React.cloneElement(editor, editorProps)
  } else if (typeof editor === 'function') {
    element = React.createElement(editor, editorProps)
  } else {
    element = <TextEditor {...editorProps} />
  }

  return (
    <div
      ref={containerRef}
      className='perun-grid-editor'
      style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, zIndex: Z_INDEX }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {element}
    </div>
  )
}
