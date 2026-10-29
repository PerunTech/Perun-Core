import React from 'react';
import AutoCompleteEditor from './AutoCompleteEditor';
import AutoCompleteFilter from './AutoCompleteFilter';
import DropDownEditor from './DropDownEditor';
import DropDownFormatter from './DropDownFormatter';
import PrintButtonFormatter from './PrintButtonFormatter';

/* The parts of the cells a column's config names, as the elements GenericGrid's columns carry
(logic/columns.js puts them on the columns), and the print column. */

const PRINT_COLUMN_KEY = '__printout_action__'

/**
 * Internal function to generate a new Editor for fields that have the appropriate configuration.
 */
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

/**
 * Internal function to generate a new Formatter for fields that have the appropriate configuration.
 */
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

/**
 * The editor, formatter and filter a column's config names: an editor for its `editorType`, a
 * formatter for its `formatterType`, and with a formatter the code list filter. Only the ones it
 * names, so that the column keeps any other it has.
 * @param {object} column - A column of the config.
 * @returns {object} Some of `editor`, `formatter` and `filterRenderer`.
 */
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

/**
 * The column with a print button in each row, for a grid given a `printout`.
 * @param {string} printout - The printout's URL, with `{rowObjectId}` where the row's object id goes.
 * @returns {object}
 */
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
