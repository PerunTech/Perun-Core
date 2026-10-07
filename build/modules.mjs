import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';

/**
 * The modules loaded on demand, each an ES module of its own beside the bundle.
 *
 * `perun-core.js` is UMD, and UMD cannot code-split: a dynamic `import()` in the
 * source is folded into the one file. Each of these is larger than the screens
 * that use it, and wanted only once somebody does -- pdfmake with its fonts for
 * the guide PDF export, the tabler icon set for `Icon`, xlsx-js-style for the
 * grids' Excel export. So each is built here, as a module of its own, and loaded
 * with the browser's `import()` by `frontend/functions/modules.js`.
 *
 * Each is `<name>.perun-core.js`, as webpack named its chunks (the first two were
 * chunks under these same names), so the jar, which packages all of www/, and
 * each consumer's dev server, which serves all of it, need to know nothing new.
 * Each module is one
 * self-contained file and imports nothing from the bundle: bytes in, plain data
 * out. That is why each has a build of its own rather than an entry in a shared
 * one -- two entries share their common code through a third file with a hashed
 * name, which nobody downstream would know to carry.
 *
 * Built by the `perun-core:on-demand-modules` plugin in vite.config.mjs, before
 * the bundle, which needs each module's version.
 *
 * `.mjs` for the same reason vite.config.mjs is: this package has no `type`
 * field, so a `.js` here would be read as CommonJS.
 */

const root = path.resolve(import.meta.dirname, '..');

/**
 * The tabler icons, without React.
 *
 * Every icon in `@tabler/icons-react` is one call, made when its module
 * evaluates: `createReactComponent(type, name, pascalName, iconNode)`, which
 * imports `forwardRef` and `createElement` from React. Built as is, this module
 * would carry a second React, and icons made by one React rendered by another.
 *
 * So here that function is replaced by one that returns its arguments, and the
 * module holds each icon's arguments instead of its component. `Icon` hands them
 * to the real `createReactComponent`, which the bundle carries with the bundle's
 * own React, and the component it gets is the one this module would have made.
 *
 * React itself is refused outright. If a later version of the package reaches
 * React some other way, the build stops here rather than shipping a second copy.
 */
function tablerIconArguments() {
  const ARGUMENTS = '\0perun-core:tabler-icon-arguments';
  return {
    name: 'perun-core:tabler-icon-arguments',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === 'react' || source.startsWith('react/') || source === 'react-dom') {
        this.error(`${importer} imports ${source}. The icon module must not carry React; see build/modules.mjs.`);
      }
      if (importer?.includes('/@tabler/icons-react/') && source.endsWith('/createReactComponent.mjs')) {
        return ARGUMENTS;
      }
      return null;
    },
    load(id) {
      return id === ARGUMENTS ? 'export default (...args) => args;' : null;
    }
  };
}

export const MODULES = {
  pdfmake: {
    entry: 'frontend/modules/pdfmake.js',
    file: 'pdfmake.perun-core.js'
  },
  'tabler-icons-react': {
    entry: 'frontend/modules/tablerIcons.js',
    file: 'tabler-icons-react.perun-core.js',
    plugins: [tablerIconArguments()]
  },
  xlsx: {
    entry: 'frontend/modules/xlsx.js',
    file: 'xlsx.perun-core.js'
  }
};

/**
 * Builds every module into `outDir`.
 *
 * @param {string} outDir - Where the bundle goes, relative to the repository.
 * @returns {Promise<Object>} Each module's file, by name, with a version taken
 *          from the file's contents. The file's name never changes, so the
 *          version is what keeps a browser from running last month's module,
 *          still in its cache, against this month's bundle.
 */
export async function buildModules(outDir) {
  const files = {};
  for (const [name, { entry, file, plugins = [] }] of Object.entries(MODULES)) {
    await build({
      configFile: false,
      root,
      publicDir: false,
      plugins,
      build: {
        outDir,
        // perun-core.js and the rest of www/ live there too.
        emptyOutDir: false,
        target: 'es2020',
        lib: {
          entry,
          formats: ['es'],
          fileName: () => file
        },
        rolldownOptions: {
          output: {
            codeSplitting: false,
            // Lib mode leaves an ES build's whitespace alone whatever
            // `build.minify` says, for a bundler downstream to shrink. Nothing
            // downstream bundles this -- a browser loads it as it is -- so the
            // output is minified here, in every mode: it is third-party code,
            // and nobody steps through it.
            minify: true
          }
        }
      }
    });
    const built = fs.readFileSync(path.resolve(root, outDir, file));
    files[name] = `${file}?v=${createHash('sha256').update(built).digest('hex').slice(0, 12)}`;
  }
  return files;
}
