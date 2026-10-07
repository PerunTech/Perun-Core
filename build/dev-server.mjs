import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

/**
 * The dev server: perun-core's page, and the bundle it loads, rebuilt on every
 * change.
 *
 * The bundle this repository ships is a UMD file that a page loads with a script
 * tag, not an app of ES modules, so Vite's module-by-module dev server has
 * nothing to serve for it. What `pnpm dev` does instead is what a deployment
 * does, with the bundle swapped for the local build: it serves www/ -- the page,
 * its config.js, `perun-core.js` and the modules it loads on demand -- with
 * `perun-core.js` rebuilt whenever a source file changes. Everything else is
 * proxied to the backend, the module bundles the shell loads included.
 *
 * The same shape as the dev servers of the module repositories, less what only
 * a module needs: there is no vendor bundle to serve beside this one, because
 * this one is the vendor bundle. Like theirs, it serves the bundle under the
 * context path a deployment serves it at, and points the page's script tag
 * there.
 *
 * `.mjs` for the same reason vite.config.mjs is: this package has no `type`
 * field, so a `.js` here would be read as CommonJS.
 */

const root = path.resolve(import.meta.dirname, '..');

/**
 * The context path a deployment serves www/ under: Activator.java registers it
 * as `/perun`.
 *
 * The bundle, its source map and the modules it loads on demand are served here
 * too, at the same URLs, as the module repositories' dev servers serve theirs.
 * The map's sources are `frontend/...` and `node_modules/...` (see sourcePath in
 * vite.config.mjs), and DevTools resolves them against the map's URL: from the
 * server's root they would land at the top of the page's origin, in one
 * `frontend/` folder with any other build that put its sources there, rather
 * than under `/perun/` as on a server.
 */
const CONTEXT = '/perun/';

/**
 * The `window.server` assignments a browser would actually run.
 *
 * Anchored to the start of a line, so a commented-out host is skipped rather
 * than read -- and global, so where several are live every one is found. Built
 * fresh per call because a `g` regex carries `lastIndex` between uses.
 */
const serverLine = () => /^([ \t]*)window\.server\s*=\s*['"]([^'"]+)['"]/gm;

/**
 * The same, for `window.json`: the host `getServerOrigin` (functions/utils.js)
 * builds the URLs of the assets' JSON and images from. Only a dev page sets it;
 * a deployment's page is on that host already.
 */
const jsonLine = () => /^([ \t]*)window\.json\s*=\s*['"]([^'"]+)['"]/gm;

/**
 * The API origin, taken from the config.js that already sits beside index.html
 * so there is only one place to change it.
 *
 * webpack-dev-server served that file as it is, and the page called the backend
 * across origins. Here the same path is proxied instead and the page is handed a
 * relative URL, as the module repositories' dev servers do. The last live
 * assignment is the one JavaScript would leave standing.
 */
const readApiUrl = (www) => {
  const file = path.join(www, 'config.js');
  if (!fs.existsSync(file)) return null;
  const found = [...fs.readFileSync(file, 'utf8').matchAll(serverLine())];
  return found.length ? new URL(found[found.length - 1][2]) : null;
};

const TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

/**
 * Serve a directory under a URL prefix; anything it does not hold goes on.
 *
 * `no-store` on everything. The page loads `perun-core.js` with no version in
 * the URL, so a browser is free to keep the copy it fetched first -- and a
 * rebuild then changes nothing on screen until its cache is cleared by hand,
 * which is indistinguishable from the new code not running.
 */
const serveDir = (prefix, dir) => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const { pathname } = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith(prefix)) return next();

  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return next();
  }
  const file = path.join(dir, relative);
  if (file !== dir && !file.startsWith(dir + path.sep)) return next();

  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return next();
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
};

/**
 * @param {{ name: string, file: string }} self  This bundle: its package name
 *   and the file the page loads.
 * @param {string} outDir  Where the build writes it, relative to the
 *   repository: www/, which also holds the page and its config.js.
 */
export function devServer(self, outDir) {
  const www = path.join(root, outDir);
  // Read when the server starts, not when the config is: `vite build` loads
  // this same config, on a CI runner with no config.js, and has no use for it.
  let api;

  /**
   * The paths the dev server answers for itself. Everything else is the
   * backend's.
   *
   * The context path, so that a bundle or module not built yet is a 404 here
   * rather than the copy deployed on the backend. And Vite's own: the client
   * that reloads the page, and what it imports. The client pulls in `env.mjs`
   * from wherever the package manager put Vite, which pnpm makes a path under
   * /node_modules/ -- left to the proxy that is the backend's 404, and the
   * client then never runs.
   */
  const owned = [CONTEXT, '/@', '/node_modules/'];

  return {
    name: `${self.name}:dev-server`,
    apply: 'serve',

    config: () => {
      api = readApiUrl(www);
      return {
        // The page is served below, not Vite's.
        appType: 'custom',
        publicDir: false,
        server: {
          port: 8080,
          proxy: api ? {
            // Inverted on purpose. The dev server owns a short, known list of
            // paths; everything else belongs to the backend -- the API, the
            // module bundles, and the shared assets whose location the server
            // only reveals at runtime through FRONTEND_ASSETS_LOCATION, so they
            // cannot be listed here. A request this plugin did not answer has
            // reached the proxy, so what is left to exempt is only what Vite
            // answers next.
            '^/': {
              target: api.origin,
              changeOrigin: true,
              secure: false,
              bypass: (req) => {
                const { pathname } = new URL(req.url, 'http://localhost');
                return owned.some(prefix => pathname.startsWith(prefix)) ? req.url : undefined;
              },
            },
          } : undefined,
        },
      };
    },

    async configureServer(server) {
      // Not just a page: the bundle, rebuilt on every change, straight into www/
      // where `pnpm build` puts it. The development build -- unminified, React's
      // development build, source maps -- as webpack-dev-server served it.
      const watcher = await build({
        configFile: server.config.configFile,
        mode: 'development',
        build: { watch: {} },
      });

      // Held back until the first bundle is written, so the first page load does
      // not meet the previous run's file, or none.
      let ready;
      const built = new Promise(resolve => { ready = resolve; });
      watcher.on('event', (event) => {
        if (event.code === 'BUNDLE_END') {
          event.result.close();
          // The job live reload did: a rebuilt bundle is a new page.
          server.ws.send({ type: 'full-reload', path: '*' });
          ready();
        } else if (event.code === 'ERROR') {
          // Vite has already printed it; the server stays up for the next save.
          ready();
        }
      });
      server.httpServer?.once('close', () => watcher.close());
      await built;

      // Serve the real config.js with only the backend's host rewritten.
      //
      // Same-origin in dev, so the proxy handles the API and CORS never applies.
      // `window.json` too, where it names the same host: left pointing there,
      // the login page's header, footer and images are fetched across origins,
      // which the assets do not allow, and nine requests fail on every load --
      // as they did under webpack-dev-server. Everything else in the file is
      // left alone.
      if (api) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' || new URL(req.url, 'http://localhost').pathname !== '/config.js') {
            return next();
          }
          const source = fs.readFileSync(path.join(www, 'config.js'), 'utf8');
          res.setHeader('Content-Type', TYPES['.js']);
          res.setHeader('Cache-Control', 'no-store');
          res.end(
            // Every live assignment, indentation kept; commented-out hosts are
            // left exactly as written so the file still documents them.
            source
              .replace(serverLine(), (_match, indent) => `${indent}window.server = '${api.pathname}'`)
              .replace(jsonLine(), (match, indent, url) =>
                URL.canParse(url) && new URL(url).origin === api.origin ? `${indent}window.json = window.location.origin` : match)
          );
        });
      }

      // The page, with the bundle taken from under the context path; config.js
      // it still loads from beside itself. Through Vite, for the client that
      // turns a rebuild into a reload.
      server.middlewares.use(async (req, res, next) => {
        const { pathname } = new URL(req.url, 'http://localhost');
        if (req.method !== 'GET' || (pathname !== '/' && pathname !== '/index.html')) return next();
        const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8').replace(
          `<script src="${self.file}"></script>`,
          `<script src="${CONTEXT}${self.file}"></script>`
        );
        res.setHeader('Content-Type', TYPES['.html']);
        res.setHeader('Cache-Control', 'no-store');
        res.end(await server.transformIndexHtml(req.url, html));
      });

      // www/ under the context path: the bundle, its source map and the modules
      // it loads on demand from beside itself.
      server.middlewares.use(serveDir(CONTEXT, www));
      // With no API to proxy to, config.js is not rewritten above, and the page
      // takes it from www/ as it is.
      if (!api) server.middlewares.use(serveDir('/', www));
    },
  };
}
