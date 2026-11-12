import React from 'react';
import AutoCompleteEditor from './AutoCompleteEditor';
import AutoCompleteFilter from './AutoCompleteFilter';
import DropDownEditor from './DropDownEditor';
import DropDownFormatter from './DropDownFormatter';
import PrintButtonFormatter from './PrintButtonFormatter';

const PRINT_COLUMN_KEY = '__printout_action__'

function generateEditorFromConfig(editorConfig) {
  let retval = null
  const editorType = editorConfig.editorType
  const editorOptions = editorConfig.editorOptions

  switch (editorType) {
    case 'DropDownEditor':
      if (editorOptions !== null && editorOptions !== undefined && editorConfig.editable) {
        retval = <DropDownEditor options={editorOptions} />
      } else if (editorOptions === null || editorOptions === undefined) {
        console.warn('No configuration provided')
      }
      break
    case 'AutoCompleteEditor':
      if (editorOptions !== null && editorOptions !== undefined) {
        retval = <AutoCompleteEditor options={editorOptions} />
      } else {
        console.warn('No configuration provided')
      }
      break
    default:
      retval = null
  }

  return retval
}

function generateFormatterFromConfig(editorConfig) {
  let retval = null
  const editorType = editorConfig.formatterType
  const editorOptions = editorConfig.formatterOptions

  switch (editorType) {
    case 'DropDownFormatter':
      if (editorOptions !== null && editorOptions !== undefined) {
        retval = <DropDownFormatter value='' options={editorOptions} />
      }
      break
    default:
      retval = null
  }

  return retval
}

// Only the parts the config names, so the column keeps any other it has.
export function columnParts(column) {
  const parts = {}
  const editorData = generateEditorFromConfig(column)
  const formatterData = generateFormatterFromConfig(column)
  if (editorData !== null && editorData !== undefined) {
    parts.editor = editorData
  }
  if (formatterData !== null && formatterData !== undefined) {
    parts.formatter = formatterData
    parts.filterRenderer = AutoCompleteFilter
  }
  return parts
}

// printout is a URL with {rowObjectId} where the row's object id goes.
export function printColumn(printout) {
  return {
    key: PRINT_COLUMN_KEY,
    name: '',
    width: 50,
    sortable: false,
    resizable: false,
    filterable: false,
    cellClass: 'print-button-cell',
    formatter: <PrintButtonFormatter printout={printout} />
  }
}
