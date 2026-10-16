/**
 * json2csv, for the grids' CSV export.
 *
 * Not part of perun-core.js: built as a module of its own beside it by
 * build/modules.mjs, and loaded by ExportableGrid the first time somebody
 * exports a grid as .csv. Small, but nothing else uses it, and a module of its
 * own rather than a place in the xlsx one keeps a CSV export from fetching the
 * Excel library as well.
 */
export { Parser } from '@json2csv/plainjs';
