import pdfMake from 'pdfmake/build/pdfmake';
import vfs from 'pdfmake/build/vfs_fonts';

pdfMake.addVirtualFileSystem(vfs);

export default pdfMake;
