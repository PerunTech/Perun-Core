import { useCallback, useState } from 'react';
import { ROW_HEIGHT } from './layout';

const NO_CELL = { rowIdx: -1, idx: -1 }

/* Whether a cell can be edited, as react-data-grid decided: its column has an editor or is marked
editable, or is given a function that decides for the row. */
function canEdit(column, row) {
  if (!column || !row) {
    return false
  }
  if (typeof column.editable === 'function') {
    return Boolean(column.editable(row))
  }
  return Boolean(column.editor || column.editable)
}

/* Whether a key pressed on the active cell opens its editor: a character, which the editor starts
with, or Enter, Backspace or Delete. Not with Ctrl or Cmd held. */
function opensEditor(event) {
  if (event.ctrlKey || event.metaKey) {
    return false
  }
  return event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete'
}

/* The cell a key moves the active cell to, as react-data-grid moved it: an arrow one cell over,
stopping at the grid's edges, and Tab (Shift+Tab back) along the row and on to the next row. Null
for Tab from the last cell or Shift+Tab from the first, which leave the grid, and undefined for any
other key. */
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

/* Whether an element got the focus from the keyboard, as :focus-visible tells, rather than from a
click. True where the browser does not know the selector. */
function focusedFromKeyboard(element) {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}

/* The cell and row a click landed in, read from the attributes the rows carry, or null for a click
outside any cell. */
function cellAt(target) {
  const cell = target instanceof Element ? target.closest('[data-idx]') : null
  const row = cell ? cell.closest('[data-row-index]') : null
  if (!row) {
    return null
  }
  return { rowIdx: Number(row.getAttribute('data-row-index')), idx: Number(cell.getAttribute('data-idx')) }
}

/**
 * TanStackGridBody's active cell and the editor opened on it: their state, and the handlers for the
 * clicks, keys and focus that move the one and open the other, as its JSDoc describes them. The body
 * puts the handlers on its viewport and on the rows' box, and draws the editor.
 * @param {object} grid - The body's `viewportRef` and `bodyRef`, its `rows` as drawn and `rowKey`, the
 *   `cells` and `widths` of its columns by position, the `headerHeight` above the rows, and the
 *   `onRowClick` and `onRowsUpdated` callbacks it was given.
 * @returns {object} `selectedCell` (`{ rowIdx, idx }`), `editing` (`{ rowIdx, idx, firstKey }` or
 *   null), `activateCell` for the multi-select cells, the handlers, and `editorRect` for the editor.
 */
export default function useActiveCell({ viewportRef, bodyRef, rows, rowKey, cells, widths, headerHeight, onRowClick, onRowsUpdated }) {
  // The active cell, which the context menu is also given; NO_CELL before the first.
  const [selectedCell, setSelectedCell] = useState(NO_CELL)
  // The cell being edited, `{ rowIdx, idx, firstKey }`, or null.
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

  /* Opens a cell's editor, when its column edits. */
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

  /* Scrolls the viewport just far enough to show a cell whole, below the header. */
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

  /* Moves the active cell for a navigation key, and tells whether the key was one. Tab from the last
  cell, or Shift+Tab from the first, leaves the browser to take the focus out of the grid. */
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
      // The key goes on to the editor, which has the focus by then, as it did in react-data-grid:
      // a character replaces the one the editor starts with, and Enter opens a dropdown's list
      // where the browser does that (Chrome on Linux).
      openEditor(selectedCell, event.key)
    }
  }

  // Tabbing into the grid makes its first cell active, as react-data-grid did; a click picks its own.
  const handleFocus = (event) => {
    if (event.target === viewportRef.current && selectedCell.rowIdx < 0 && rows.length > 0 && focusedFromKeyboard(event.target)) {
      setSelectedCell({ rowIdx: 0, idx: 0 })
    }
  }

  /* An edit saved: given to GenericGrid as react-data-grid gave it, then a key that saved it and
  moves on moves the active cell, as it would have without the editor. */
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

  /* Where the edited cell is on screen, from the rows' box, which the scroll and the header have
  already placed, and the widths of the columns before it. */
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
