import React from 'react';
import { useIntl } from 'react-intl';
import { ContextMenu, MenuItem } from './ContextMenu';
import { prepJsonFromConf } from '../logic/exportRows';
import { store, rowClicked } from '../../../model';
import { label } from '../logic/labels';

function copyRow(rows, gridConfig, rowIdx) {
  // this saves the whole row as string
  const selectedRow = prepJsonFromConf(gridConfig, [rows[rowIdx]])
  const keys = Object.keys(selectedRow[0])
  let string = ''
  for (let i = 0; i < keys.length; i++) {
    string = string + String(keys[i]) + ': ' + String(selectedRow[0][keys[i]]) + ', '
  }
  saveCopiedValueToClipboard(string)
}

function copyCell(rows, gridConfig, rowIdx, idx, enableMultiSelect) {
  // try to find the cell in the row by IDX
  let cellType
  if (typeof enableMultiSelect !== 'undefined' && enableMultiSelect) {
    if (idx === 0) {
      cellType = gridConfig[idx].name
    } else {
      cellType = gridConfig[idx - 1].name
    }
  } else {
    cellType = gridConfig[idx].name
  }
  const selectedRow = prepJsonFromConf(gridConfig, [rows[rowIdx]])
  let cellValue = String(selectedRow[0][cellType])
  saveCopiedValueToClipboard(cellValue)
}

function saveCopiedValueToClipboard(string) {
  /* next, we have to create a hidden element and and set the string row as value
  so we can save it to clipboard, because thats how javascript does it */
  const el = document.createElement('textarea')
  el.value = string
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

// Edit row: the row counts as clicked, then the grid's editContextFunc is called with it.
function editRow(editContextFunc, id, rowIdx, row) {
  store.dispatch(rowClicked(id, row, rowIdx))
  editContextFunc(id, rowIdx, row)
}

const ContextMenuPopup = ({ rows, gridConfig, idx, id, rowIdx, enableMultiSelect, editContextFunc }) => {
  const intl = useIntl()
  return (
    <ContextMenu id={id}>
      {editContextFunc && (
        <MenuItem action='edit-row' onClick={() => editRow(editContextFunc, id, rowIdx, rows[rowIdx])}>
          {label(intl, 'main.grids.edit_row')}
        </MenuItem>
      )}
      <MenuItem action='copy-row' onClick={() => copyRow(rows, gridConfig, rowIdx)}>
        {label(intl, 'main.grids.copy_row')}
      </MenuItem>
      <MenuItem action='copy-cell' onClick={() => copyCell(rows, gridConfig, rowIdx, idx, enableMultiSelect)}>
        {label(intl, 'main.grids.copy_cell')}
      </MenuItem>
    </ContextMenu>
  )
}

export default ContextMenuPopup
