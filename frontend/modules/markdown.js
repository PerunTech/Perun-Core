/**
 * marked and DOMPurify, for the user guides.
 *
 * Not part of perun-core.js: built as a module of its own beside it by
 * build/modules.mjs, and loaded by `loadMarkdown` (elements/guides/renderMarkdown.js)
 * the first time a guide is read, previewed in the editor or exported as a PDF.
 * Together they were a twenty-fifth of the bundle, and every other screen
 * carried them unused.
 *
 * Only the two libraries: how a guide is rendered, sanitized and stamped with
 * its source lines stays in the bundle, beside the code that reads the result.
 */
export { marked } from 'marked';
export { default as DOMPurify } from 'dompurify';
