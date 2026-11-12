import React, { useLayoutEffect, useRef, useState } from 'react';
import TextEditor from '../cells/TextEditor';

const Z_INDEX = 10

// A character typed to open the editor replaces the value; Delete and Backspace start it empty.
function initialValue(value, firstKey) {
  if (firstKey === 'Delete' || firstKey === 'Backspace') {
    return ''
  }
  return firstKey === undefined || firstKey === 'Enter' ? value : firstKey
}

function caretAtEdge(input, key) {
  if (!input || typeof input.selectionStart !== 'number') {
    return false
  }
  return key === 'ArrowLeft'
    ? input.selectionStart === 0 && input.selectionEnd === 0
    : input.selectionStart === input.value.length
}

// An editor gets column, value, rowData, height, onCommit, onCommitCancel and onBlur, and provides
// getInputNode(), getValue() and optionally hasResults(), true while Up and Down stay in its list.
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
