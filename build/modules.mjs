import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';

// UMD can't code-split, so each on-demand library (frontend/functions/modules.js) is a self-contained
// ES module beside the bundle, built on its own so no shared chunk appears.

const root = path.resolve(import.meta.dirname, '..');

// The tabler icons without React: createReactComponent returns its arguments and Icon makes the
// component with the bundle's React. Any import of React fails the build.
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
  },
  csv: {
    entry: 'frontend/modules/csv.js',
    file: 'csv.perun-core.js'
  },
  markdown: {
    entry: 'frontend/modules/markdown.js',
    file: 'markdown.perun-core.js'
  },
  'rich-text': {
    entry: 'frontend/modules/richText.js',
    file: 'rich-text.perun-core.js'
  }
};

// Builds every module into outDir and returns each one's file with a content
// hash as `?v=`, so a cached module is never run against a newer bundle.
export async function buildModules(outDir, logLevel) {
  const files = {};
  for (const [name, { entry, file, plugins = [] }] of Object.entries(MODULES)) {
    await build({
      configFile: false,
      root,
      logLevel,
      publicDir: false,
      plugins,
      build: {
        outDir,
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
            // Lib mode never minifies an ES build on its own.
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

// Builds the modules and defines __PERUN_CORE_MODULES__, in `config` (the last hook that can add a
// define) and once per process, so pnpm dev's rebuilds skip them.
export function onDemandModules(outDir) {
  let files;
  return {
    name: 'perun-core:on-demand-modules',
    apply: 'build',
    async config(config) {
      files ??= await buildModules(config.build?.outDir ?? outDir, config.logLevel);
      return { define: { __PERUN_CORE_MODULES__: JSON.stringify(files) } };
    }
  };
}
