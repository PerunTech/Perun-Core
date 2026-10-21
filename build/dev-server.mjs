import fs from 'node:fs';
import path from 'node:path';
import { build, loadEnv } from 'vite';

// `pnpm dev`: serves www/ as a deployment does, with perun-core.js rebuilt on
// every change, and proxies everything else to PERUN_BACKEND.

const root = path.resolve(import.meta.dirname, '..');

// Where a deployment serves www/ (Activator.java). The bundle is served there
// too, so its source map paths match a deployment's.
const CONTEXT = '/perun/';

// getServer sets window.server to the backend's frontend.server property.
const SERVICES = '/services';
const GET_SERVER = `${SERVICES}/WsConf/getServer`;

// Live window.server assignments only: anchored to the line start, so commented
// ones are skipped. A function, since a /g regex keeps lastIndex between uses.
const serverLine = () => /^([ \t]*)window\.server\s*=\s*['"]([^'"]+)['"]/gm;

// PERUN_BACKEND's origin, from the environment or .env.local.
const backendOrigin = (mode) => {
  const value = loadEnv(mode, root, 'PERUN_').PERUN_BACKEND;
  if (!value || !URL.canParse(value)) {
    throw new Error(
      `PERUN_BACKEND ${value ? `is not a URL: ${value}` : 'is not set'}. Name the backend's origin ` +
      'in .env.local (PERUN_BACKEND=http://<host>:<port>) or in the environment.'
    );
  }
  return new URL(value).origin;
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

// Serves dir under prefix. no-store, since the page loads perun-core.js with no
// version in the URL and a browser would keep the first copy.
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
 * @param {{ name: string, file: string }} self  The package name and bundle file.
 * @param {string} outDir  www/, relative to the repository.
 */
export function devServer(self, outDir) {
  const www = path.join(root, outDir);
  // Set in `config`, which only runs for the dev server: CI builds have no PERUN_BACKEND.
  let backend;

  // Paths answered here; everything else goes to the backend. pnpm puts Vite's
  // client under /node_modules/.
  const owned = [CONTEXT, '/@', '/node_modules/'];

  return {
    name: `${self.name}:dev-server`,
    apply: 'serve',

    config: (_config, { mode }) => {
      backend = backendOrigin(mode);
      return {
        appType: 'custom',
        publicDir: false,
        server: {
          // Where it starts looking: Vite takes the next free port if this one is taken.
          port: 8080,
          proxy: {
            '^/': {
              target: backend,
              changeOrigin: true,
              secure: false,
              bypass: (req) => {
                const { pathname } = new URL(req.url, 'http://localhost');
                return owned.some(prefix => pathname.startsWith(prefix)) ? req.url : undefined;
              },
            },
          },
        },
      };
    },

    async configureServer(server) {
      const watcher = await build({
        configFile: server.config.configFile,
        mode: 'development',
        build: { watch: {} },
      });

      // Wait for the first bundle, so the first page load doesn't get a stale one.
      let ready;
      const built = new Promise(resolve => { ready = resolve; });
      watcher.on('event', (event) => {
        if (event.code === 'BUNDLE_END') {
          event.result.close();
          server.ws.send({ type: 'full-reload', path: '*' });
          ready();
        } else if (event.code === 'ERROR') {
          // Vite has printed it; keep serving for the next save.
          ready();
        }
      });
      server.httpServer?.once('close', () => watcher.close());
      await built;

      // getServer, with an absolute window.server answered as /services, so the
      // page's requests stay on this origin and go through the proxy.
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || new URL(req.url, 'http://localhost').pathname !== GET_SERVER) {
          return next();
        }
        let answer, source;
        try {
          answer = await fetch(new URL(req.url, backend));
          source = await answer.text();
        } catch (error) {
          server.config.logger.error(`getServer: no answer from ${backend} (${error.cause?.code ?? error.message})`, { timestamp: true });
          res.statusCode = 502;
          return res.end();
        }
        res.statusCode = answer.status;
        res.setHeader('Content-Type', answer.headers.get('content-type') ?? TYPES['.js']);
        res.setHeader('Cache-Control', 'no-store');
        res.end(answer.ok
          ? source.replace(serverLine(), (match, indent, url) =>
            URL.canParse(url) ? `${indent}window.server = '${SERVICES}'` : match)
          : source);
      });

      // The page, with its script tag pointed under CONTEXT, through Vite for
      // its reload client.
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

      server.middlewares.use(serveDir(CONTEXT, www));
    },
  };
}
