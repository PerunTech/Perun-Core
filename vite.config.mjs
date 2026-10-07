import { defineConfig, transformWithOxc } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { devServer } from './build/dev-server.mjs';
import { buildModules } from './build/modules.mjs';

/**
 * The bundle: one UMD file, `www/perun-core.js`.
 *
 * Every page loads it with a script tag, and every module bundle leaves
 * `perun-core` to the global it publishes, `window['perun-core']`, so the format
 * and the global's name are the contract. Both halves are in package.json. This
 * is the shell: React, Redux and every other library the modules share come in
 * here, and nothing is external.
 *
 * Two libraries too large for every screen are not in it. UMD cannot
 * code-split, so they are modules of their own beside it, built first by the
 * `onDemandModules` plugin below -- see build/modules.mjs.
 *
 * `pnpm dev` serves this file, rebuilt on every save, behind perun-core's own
 * page -- see build/dev-server.mjs.
 *
 * `.mjs` because this package has no `type` field, so a `.js` here would be read
 * as CommonJS.
 */
const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'));
const self = { name: pkg.name, file: path.basename(pkg.main) };
const outDir = path.dirname(pkg.main);

const frontend = path.resolve(import.meta.dirname, 'frontend') + path.sep;

/**
 * The three builds, by mode, as webpack made them.
 *
 * `build-dev` is the bundle CI builds for the dev branch, both for the jar and
 * for the copy it commits: the production one, minified and running React's
 * production build, with source maps and the debug flag on. It is not a
 * development build. That is only what `pnpm dev` serves.
 *
 * `MODE` and `DEBUG` are read through `process.env` in the source
 * (model/store.js, config/config.js), and `NODE_ENV` by React, Redux and the
 * rest to choose their production builds. webpack replaced all three; library
 * mode leaves `process.env` alone for a downstream bundler, and there is none --
 * a browser runs this file as it is -- so they are defined here.
 */
const BUILDS = {
  // pnpm build
  production: { nodeEnv: 'production', debug: false, sourcemap: false, minify: true },
  // pnpm build-dev
  debug: { nodeEnv: 'production', debug: true, sourcemap: true, minify: true },
  // pnpm dev
  development: { nodeEnv: 'development', debug: true, sourcemap: true, minify: false }
};

/**
 * JSX in `.js`, as babel-loader read it.
 *
 * Every frontend file is `.js` and many hold JSX, and Vite takes a file's
 * language from its extension -- so the parser refuses the first tag it meets.
 * Renaming the files to `.jsx` would put a rename into every blame on them, so
 * the language is stated here instead, for this repository's own source only.
 *
 * Classic JSX: `React.createElement`, as Babel's preset compiled it, and as the
 * modules built against this bundle compile theirs.
 */
const jsxInJs = () => ({
  name: 'perun-core:jsx-in-js',
  enforce: 'pre',
  transform(code, id) {
    if (!id.startsWith(frontend) || !id.endsWith('.js')) return null;
    return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'classic' } });
  }
});

// A module standing in for a sheet. The id must not end in `.css`, or Vite's own
// CSS handling claims it and reads the generated JavaScript as a stylesheet.
const STYLE = '\0perun-core-style:';
const AS_JS = '.js';
const INSERT = '\0perun-core-style-insert';

/**
 * Each stylesheet a module imports becomes a `<style>` appended to `<head>`,
 * inserted when that module evaluates -- what style-loader did, one element per
 * sheet in import order: Bootstrap, then style.css. Vite's own answer is a
 * single extracted .css file, and nothing loads one: every page that uses
 * perun-core loads the script and nothing else.
 *
 * Where these land against the stylesheets index.html links from the
 * deployment's assets is a race, and was under webpack too: the page appends
 * those once its FRONTEND_ASSETS_LOCATION request answers, and these go in when
 * this file has downloaded and runs. Whichever is later wins ties. Measured
 * through the dev server's proxy, the links came first on every load with both
 * bundles, so Bootstrap's sheet sat after the deployment's.
 *
 * Not minified, as css-loader did not: lightningcss would respell values, and
 * the deployments' sheets override these as written. Bootstrap's is already
 * minified, and style.css is small.
 */
function stylePerSheet() {
  return {
    name: 'perun-core:style-per-sheet',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === INSERT) return INSERT;
      if (!importer || !source.endsWith('.css')) return null;
      // webpack's config had a CSS modules rule, and nothing imports a CSS
      // module now. A sheet inserted as it is has no class names to export, so
      // an import of one would build and then style nothing; it is stopped
      // here instead.
      if (source.endsWith('.module.css')) {
        this.error(`${importer} imports the CSS module ${source}. This build inserts each sheet as it is (see stylePerSheet in vite.config.mjs) and has no CSS modules; use a plain sheet with the class names written out.`);
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && STYLE + resolved.id + AS_JS;
    },
    load(id) {
      if (id === INSERT) {
        return [
          'export default function insert(css) {',
          '  const style = document.createElement("style");',
          '  style.textContent = css;',
          '  document.head.appendChild(style);',
          '}'
        ].join('\n');
      }
      if (!id.startsWith(STYLE)) return null;
      const sheet = id.slice(STYLE.length, -AS_JS.length);
      return [
        `import insert from ${JSON.stringify(INSERT)};`,
        `import css from ${JSON.stringify(sheet + '?inline')};`,
        'insert(css);'
      ].join('\n');
    },
    // Without the sheet's own source map comment, as css-loader left it.
    // bootstrap.min.css ends with one naming a .map that is not vendored, and
    // in a `<style>` it points at the page's directory, so DevTools asks the
    // server for it and logs the 404.
    transform(code, id) {
      if (!id.endsWith('.css?inline')) return null;
      return { code: code.replace(/\n?\/\*# sourceMappingURL=[^*]*\*\/\s*$/, ''), map: null };
    }
  };
}

/**
 * The modules loaded on demand, built before the bundle.
 *
 * The bundle asks for each by its file and a version taken from that file's
 * contents, so they have to exist first; `__PERUN_CORE_MODULES__` carries the
 * names and versions in. Built in the `config` hook because that is the last
 * point at which a `define` can still be added. Only once per process: the
 * watch build `pnpm dev` runs resolves its config once, and its rebuilds leave
 * the modules alone, since nothing in frontend/ but their two entry files goes
 * into them.
 */
function onDemandModules() {
  let files;
  return {
    name: 'perun-core:on-demand-modules',
    apply: 'build',
    async config() {
      files ??= await buildModules(outDir);
      return { define: { __PERUN_CORE_MODULES__: JSON.stringify(files) } };
    }
  };
}

/**
 * Source paths in the map, relative to the repository rather than to the map.
 *
 * DevTools resolves each source against the map's URL, which in a deployment is
 * `/perun/perun-core.js.map`. Relative to the map's own folder the sources are
 * `../frontend/...`, which climbs out of the context path to the server's root,
 * and DevTools files them there beside any other bundle's that do the same --
 * `frontend/client.js` is a name most of them have. As `frontend/...` they stay
 * under `/perun/`, as the module bundles' stay under theirs. The map carries
 * the sources' text, so nothing is fetched from those URLs.
 */
const sourcePath = (source, map) =>
  path.relative(import.meta.dirname, path.resolve(path.dirname(map), source)).split(path.sep).join('/');

export default defineConfig(({ mode }) => {
  const settings = BUILDS[mode];
  if (!settings) {
    throw new Error(`perun-core has no build called "${mode}". The modes are: ${Object.keys(BUILDS).join(', ')}.`);
  }

  return {
    publicDir: false,
    plugins: [jsxInJs(), stylePerSheet(), onDemandModules(), devServer(self, outDir)],
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.nodeEnv),
      'process.env.MODE': JSON.stringify(settings.nodeEnv),
      'process.env.DEBUG': JSON.stringify(String(settings.debug))
    },
    build: {
      outDir,
      // The directory also holds index.html and config.js, and the jar packages
      // all of it.
      emptyOutDir: false,
      // ES2020 is what perun-core already needed: Babel's preset left optional
      // chaining in place for its targets. Every module bundle built against
      // this one is built for the same, so nothing runs one where the shell
      // could not run.
      target: 'es2020',
      sourcemap: settings.sourcemap,
      minify: settings.minify,
      cssMinify: false,
      lib: {
        entry: 'frontend/client.js',
        name: self.name,
        formats: ['umd'],
        fileName: () => self.file
      },
      rolldownOptions: {
        // react-bootstrap opens a hundred-odd files with "use client", which
        // marks a boundary for React Server Components and means nothing in a
        // browser bundle; each one is a warning that the directive is dropped.
        // That one is left out so the warnings that do matter can be seen.
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) return;
          warn(warning);
        },
        output: {
          // `window['perun-core'].__esModule`, as webpack set it, so a bundle
          // that default-imports perun-core resolves it the way it always has.
          esModule: true,
          sourcemapPathTransform: sourcePath
        }
      }
    }
  };
});
