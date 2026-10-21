import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { devServer } from './build/dev-server.mjs';
import { onDemandModules } from './build/modules.mjs';
import { jsxInJs, stylePerSheet } from './build/plugins.mjs';

// One UMD file, www/perun-core.js, published as window['perun-core'] with
// nothing external. `.mjs` because package.json has no `type` field.
const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'));
const self = { name: pkg.name, file: path.basename(pkg.main) };
const outDir = path.dirname(pkg.main);

const BUILDS = {
  // pnpm build
  production: { nodeEnv: 'production', debug: false, sourcemap: false, minify: true },
  // pnpm build-dev, what CI ships for dev: the production bundle with maps and debug
  debug: { nodeEnv: 'production', debug: true, sourcemap: true, minify: true },
  // pnpm dev
  development: { nodeEnv: 'development', debug: true, sourcemap: true, minify: false }
};

// Map sources as `frontend/...`, not `../frontend/...`, so DevTools keeps them
// under /perun/ rather than at the origin's root.
const sourcePath = (source, map) =>
  path.relative(import.meta.dirname, path.resolve(path.dirname(map), source)).split(path.sep).join('/');

export default defineConfig(({ mode }) => {
  const settings = BUILDS[mode];
  if (!settings) {
    throw new Error(`perun-core has no build called "${mode}". The modes are: ${Object.keys(BUILDS).join(', ')}.`);
  }

  return {
    publicDir: false,
    plugins: [jsxInJs(), stylePerSheet(), onDemandModules(outDir), devServer(self, outDir)],
    // Library mode leaves process.env to a later bundler, and there is none.
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.nodeEnv),
      'process.env.MODE': JSON.stringify(settings.nodeEnv),
      'process.env.DEBUG': JSON.stringify(String(settings.debug))
    },
    build: {
      outDir,
      // www/ also holds index.html and config.js.
      emptyOutDir: false,
      target: 'es2020',
      sourcemap: settings.sourcemap,
      minify: settings.minify,
      // The deployments' sheets override these as written.
      cssMinify: false,
      lib: {
        entry: 'frontend/client.js',
        name: self.name,
        formats: ['umd'],
        fileName: () => self.file
      },
      rolldownOptions: {
        // react-bootstrap's "use client" directives warn once per file.
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) return;
          warn(warning);
        },
        output: {
          // Sets __esModule, so bundles that default-import perun-core keep working.
          esModule: true,
          sourcemapPathTransform: sourcePath
        }
      }
    }
  };
});
