/**
 * pdfmake with its fonts, for the guide PDF export.
 *
 * Not part of perun-core.js: built as a module of its own beside it by
 * build/modules.mjs, and loaded by `renderGuidePdf` the first time somebody
 * exports. Both files are large and neither is wanted before then.
 */
import pdfMake from 'pdfmake/build/pdfmake';
import vfs from 'pdfmake/build/vfs_fonts';

pdfMake.addVirtualFileSystem(vfs);

export default pdfMake;
