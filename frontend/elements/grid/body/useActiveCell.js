import { useCallback, useState } from 'react';
import { ROW_HEIGHT } from './layout';

const NO_CELL = { rowIdx: -1, idx: -1 }

function canEdit(column, row) {
  if (!column || !row) {
    return false
  }
  if (typeof column.editable === 'function') {
    return Boolean(column.editable(row))
  }
  return Boolean(column.editor || column.editable)
}

function opensEditor(event) {
  if (event.ctrlKey || event.metaKey) {
    return false
  }
  return event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete'
}

// Null for Tab out of the last cell or Shift+Tab out of the first, which leave the grid; undefined
// for any other key.
function nextCell(event, from, rowCount, colCount) {
  const rowIdx = Math.min(Math.max(from.rowIdx, 0), rowCount - 1)
  const idx = Math.min(Math.max(from.idx, 0), colCount - 1)
  switch (event.key) {
    case 'ArrowUp':
      return { rowIdx: Math.max(rowIdx - 1, 0), idx }
    case 'ArrowDown':
      return { rowIdx: Math.min(rowIdx + 1, rowCount - 1), idx }
    case 'ArrowLeft':
      return { rowIdx, idx: Math.max(idx - 1, 0) }
    case 'ArrowRight':
      return { rowIdx, idx: Math.min(idx + 1, colCount - 1) }
    case 'Tab':
      if (event.shiftKey) {
        if (idx > 0) {
          return { rowIdx, idx: idx - 1 }
        }
        return rowIdx > 0 ? { rowIdx: rowIdx - 1, idx: colCount - 1 } : null
      }
      if (idx < colCount - 1) {
        return { rowIdx, idx: idx + 1 }
      }
      return rowIdx < rowCount - 1 ? { rowIdx: rowIdx + 1, idx: 0 } : null
    default:
      return undefined
  }
}

// True where the browser doesn't know :focus-visible.
function focusedFromKeyboard(element) {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}

function cellAt(target) {
  const cell = target instanceof Element ? target.closest('[data-idx]') : null
  const row = cell ? cell.closest('[data-row-index]') : null
  if (!row) {
    return null
  }
  return { rowIdx: Number(row.getAttribute('data-row-index')), idx: Number(cell.getAttribute('data-idx')) }
}

export default function useActiveCell({ viewportRef, bodyRef, rows, rowKey, cells, widths, headerHeight, onRowClick, onRowsUpdated }) {
  const [selectedCell, setSelectedCell] = useState(NO_CELL)
  const [editing, setEditing] = useState(null)

  const focusGrid = useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.focus({ preventScroll: true })
    }
  }, [viewportRef])

  // For the multi-select cells, whose clicks do not reach the rows' handler.
  const activateCell = useCallback((cell) => {
    setSelectedCell(cell)
    focusGrid()
  }, [focusGrid])

  const handleClick = (event) => {
    const cell = cellAt(event.target)
    if (cell) {
      activateCell(cell)
      if (onRowClick) {
        onRowClick(cell.rowIdx, rows[cell.rowIdx])
      }
    }
  }

  // Before the menu opens, so that it reads the row and column it was opened on.
  const handleContextMenu = (event) => {
    const cell = cellAt(event.target)
    if (cell) {
      setSelectedCell(cell)
    }
  }

  const openEditor = (cell, firstKey) => {
    const column = cells[cell.idx] && cells[cell.idx].column
    if (!editing && canEdit(column, rows[cell.rowIdx])) {
      setEditing({ rowIdx: cell.rowIdx, idx: cell.idx, firstKey })
    }
  }

  const handleDoubleClick = (event) => {
    const cell = cellAt(event.target)
    if (cell) {
      setSelectedCell(cell)
      openEditor(cell)
    }
  }

  const scrollIntoView = ({ rowIdx, idx }) => {
    const viewport = viewportRef.current
    const top = rowIdx * ROW_HEIGHT
    const bottom = headerHeight + top + ROW_HEIGHT
    if (top < viewport.scrollTop) {
      viewport.scrollTop = top
    } else if (bottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = bottom - viewport.clientHeight
    }
    const left = widths.slice(0, idx).reduce((sum, width) => sum + width, 0)
    const right = left + widths[idx]
    if (left < viewport.scrollLeft) {
      viewport.scrollLeft = left
    } else if (right > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollLeft = right - viewport.clientWidth
    }
  }

  // Tab out of the last cell, or Shift+Tab out of the first, is left to the browser.
  const navigate = (event, from) => {
    const next = nextCell(event, from, rows.length, cells.length)
    if (next === undefined) {
      return false
    }
    if (next !== null) {
      event.preventDefault()
      setSelectedCell(next)
      scrollIntoView(next)
    }
    return true
  }

  // Keys pressed on the grid itself, not in a filter, a cell's control or an editor.
  const handleKeyDown = (event) => {
    if (event.target !== viewportRef.current || editing || rows.length === 0 || cells.length === 0) {
      return
    }
    const from = selectedCell.rowIdx < 0 ? { rowIdx: 0, idx: 0 } : selectedCell
    if (selectedCell.rowIdx < 0 && nextCell(event, from, rows.length, cells.length)) {
      // The first key on a grid without an active cell only makes the first cell active.
      event.preventDefault()
      setSelectedCell(from)
      scrollIntoView(from)
    } else if (!navigate(event, from) && selectedCell.rowIdx >= 0 && opensEditor(event)) {
      // The key goes on to the editor, which has the focus by then: a character replaces its value,
      // and Enter opens a dropdown where the browser does that (Chrome on Linux).
      openEditor(selectedCell, event.key)
    }
  }

  // Tabbing in makes the first cell active; a click picks its own.
  const handleFocus = (event) => {
    if (event.target === viewportRef.current && selectedCell.rowIdx < 0 && rows.length > 0 && focusedFromKeyboard(event.target)) {
      setSelectedCell({ rowIdx: 0, idx: 0 })
    }
  }

  // A key that saved and moves on also moves the active cell.
  const handleEditorCommit = (updated, event, hadFocus) => {
    const { rowIdx, idx } = editing
    setEditing(null)
    const row = rows[rowIdx]
    if (row && onRowsUpdated) {
      const rowId = row[rowKey]
      onRowsUpdated({
        cellKey: cells[idx].column.key,
        fromRow: rowIdx,
        toRow: rowIdx,
        fromRowId: rowId,
        toRowId: rowId,
        rowIds: [rowId],
        updated,
        action: 'CELL_UPDATE',
        fromRowData: row
      })
    }
    // Tab out of the last cell keeps it active and lets the focus go on.
    const leaves = event && nextCell(event, { rowIdx, idx }, rows.length, cells.length) === null
    if (event && !leaves) {
      navigate(event, { rowIdx, idx })
    }
    if (hadFocus && !leaves) {
      focusGrid()
    }
  }

  const handleEditorCancel = (hadFocus) => {
    setEditing(null)
    if (hadFocus) {
      focusGrid()
    }
  }

  // From the rows' box, which the scroll and the header have already placed.
  const editorRect = () => {
    const body = bodyRef.current.getBoundingClientRect()
    const left = widths.slice(0, editing.idx).reduce((sum, width) => sum + width, body.left)
    return { top: body.top + editing.rowIdx * ROW_HEIGHT, left, width: widths[editing.idx], height: ROW_HEIGHT }
  }

  return {
    selectedCell, editing, activateCell, handleClick, handleContextMenu, handleDoubleClick, handleKeyDown, handleFocus,
    handleEditorCommit, handleEditorCancel, editorRect
  }
}
