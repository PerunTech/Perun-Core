// The PERUN_PLUGIN rows help content hangs off. A module owns a row; its guides, manuals and
// figures are files on that row.

import axios from 'axios'
import { PLUGIN_TABLE, readItems, readObjectId, readValue, requireResponse } from './helpApi'

const pluginCol = (row, name) => row[`${PLUGIN_TABLE}.${name}`] ?? readValue(row, name)

// Rows like grid-table and single-form-table are built-in placeholders rather than deployed
// modules, and carry "/" in every path column. A real JAVASCRIPT_PATH is what separates a module
// that can own help content from one that cannot.
const isModuleRow = (row) => {
  const jsPath = String(pluginCol(row, 'JAVASCRIPT_PATH') ?? '').trim()
  return Boolean(jsPath) && jsPath !== '/'
}

// getTableData translates LABEL_CODE when the plugin has a label, and leaves the raw code in place
// when it does not, so an untranslated code falls back to the context name.
const moduleTitle = (row, contextName) => {
  const label = pluginCol(row, 'LABEL_CODE')
  return label && !String(label).startsWith('perun.') ? label : contextName
}

/**
 * Every module that can own help content, as { id, title, objectId }, in one call.
 *
 * getTableData serializes through prapareTableQueryData, so one call answers with every plugin
 * row in the TABLE.COLUMN shape parsed below, rather than one lookup per module.
 */
export const listHelpModules = async (svSession) => {
  const url = `${window.server}/ReactElements/getTableData/${svSession}/${PLUGIN_TABLE}/0`
  const response = requireResponse(await axios.get(url))
  const rows = Array.isArray(response?.data) ? response.data : readItems(response?.data)
  return toHelpModules(rows)
}

/** The mapping half, so the fetch above is only the fetch. */
const toHelpModules = (rows) => (rows ?? [])
  .filter(isModuleRow)
  .map(row => {
    const id = pluginCol(row, 'CONTEXT_NAME')
    return {
      id,
      title: moduleTitle(row, id),
      objectId: pluginCol(row, 'OBJECT_ID') ?? readObjectId(row),
      sortOrder: Number(pluginCol(row, 'SORT_ORDER')) || 0
    }
  })
  .filter(module => module.id && module.objectId)
  .sort((a, b) => a.sortOrder - b.sortOrder || String(a.title).localeCompare(String(b.title)))
