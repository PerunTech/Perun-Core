/**
 * xlsx-js-style, for the grids' Excel export.
 *
 * Not part of perun-core.js: built as a module of its own beside it by
 * build/modules.mjs, and loaded by ExportableGrid the first time somebody
 * exports a grid as .xls or .xlsx. On its own it was a fifth of the bundle, and
 * nothing else uses it.
 */
import xlsx from 'xlsx-js-style';

export default xlsx;
