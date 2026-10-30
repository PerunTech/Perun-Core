import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { build } from 'vite';

// `pnpm analyze`: builds what `pnpm build` builds, plus a map, into a temp
// folder (www/ is left alone) and reports what perun-core.js is made of, each
// byte credited to the source the map names for it.

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const file = path.basename(pkg.main);
const outDir = path.join(os.tmpdir(), 'perun-core-analyze');

// Rows smaller than this are summed into one.
const SMALL = 2000;

const gzip = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;
const kb = (bytes) => (bytes / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const BASE64 = Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'].map((c, i) => [c, i]));

// Each generated line's segments as [column, source index or -1]. Only the
// column and source fields are kept; the source field is a running delta.
function decodeMappings(mappings) {
  let source = 0;
  return mappings.split(';').map((line) => {
    let column = 0;
    return line.split(',').filter(Boolean).map((segment) => {
      const fields = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = BASE64[char];
        value += (digit & 31) * 2 ** shift;
        if (digit & 32) {
          shift += 5;
        } else {
          fields.push(value % 2 ? -(value - 1) / 2 : value / 2);
          value = 0;
          shift = 0;
        }
      }
      column += fields[0];
      if (fields.length < 4) return [column, -1];
      source += fields[1];
      return [column, source];
    });
  });
}

// [start, end, source index or -1] over the bundle's text. A line that starts
// with no segment continues the previous line's last one, as a string with a
// line break in it does.
function ranges(text, map) {
  const decoded = decodeMappings(map.mappings);
  const result = [];
  let offset = 0;
  let open = -1;
  text.split('\n').forEach((line, i) => {
    const end = offset + line.length + 1;
    const starts = [[0, open], ...(decoded[i] ?? [])];
    starts.forEach(([column, source], j) => result.push([offset + column, starts[j + 1] ? offset + starts[j + 1][0] : end, source]));
    open = starts.at(-1)[1];
    offset = end;
  });
  return result;
}

// A dependency by its package name and our own code by frontend/'s first two folders.
function owner(source) {
  const nodeModules = source.lastIndexOf('node_modules/');
  if (nodeModules >= 0) {
    const parts = source.slice(nodeModules + 'node_modules/'.length).split('/');
    return { kind: 'package', name: parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0] };
  }
  if (source.startsWith('frontend/')) {
    const folders = source.split('/').slice(0, -1);
    return { kind: 'own', name: `${folders.slice(0, 3).join('/')}/` };
  }
  return { kind: 'package', name: source };
}

// Vite makes a `?inline` stylesheet a string module with an empty map, so the
// map credits the string to whatever comes before it. Its text is kept here to
// find it in the bundle instead.
const stylesheets = new Map();
const keepStylesheets = () => ({
  name: 'perun-core:analyze-stylesheets',
  enforce: 'post',
  transform(code, id) {
    if (id.endsWith('.css?inline')) {
      stylesheets.set(id, JSON.parse(code.slice(code.indexOf('"'), code.lastIndexOf('"') + 1)));
    }
    return null;
  }
});

// Where a string starting with `text`'s first characters sits in the bundle,
// up to its closing quote. The minifier may write it in either quote.
function findString(text, start) {
  const head = start.slice(0, 64);
  const written = ['`' + head.replace(/[\\`]/g, '\\$&').replace(/\$\{/g, '\\${'), JSON.stringify(head).slice(0, -1)];
  for (const quoted of written) {
    const at = text.indexOf(quoted);
    if (at < 0) continue;
    for (let i = at + 1; i < text.length; i++) {
      if (text[i] === '\\') i++;
      else if (text[i] === text[at]) return [at, i + 1];
    }
  }
  return null;
}

const row = (name, bytes) => ({ name, raw: bytes.length, gzip: gzip(bytes) });

// `total` adds a column with each row's share of it.
function table(title, rows, total) {
  rows.sort((a, b) => b.raw - a.raw);
  const shown = rows.filter((r) => r.raw >= SMALL);
  const rest = rows.filter((r) => r.raw < SMALL);
  if (rest.length) {
    shown.push({
      name: `${rest.length} smaller, under ${kb(SMALL)} KB each`,
      raw: rest.reduce((sum, r) => sum + r.raw, 0),
      gzip: rest.reduce((sum, r) => sum + r.gzip, 0)
    });
  }
  const width = Math.max(...shown.map((r) => r.name.length));
  const share = (r) => (total ? `  ${`${((r.raw / total) * 100).toFixed(1)}%`.padStart(6)}` : '');
  console.log(`\n${title}\n`);
  console.log(`  ${''.padEnd(width)}  ${'KB'.padStart(8)}${total ? `  ${'share'.padStart(6)}` : ''}  ${'KB gzip'.padStart(8)}`);
  for (const r of shown) {
    console.log(`  ${r.name.padEnd(width)}  ${kb(r.raw).padStart(8)}${share(r)}  ${kb(r.gzip).padStart(8)}`);
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
await build({
  root,
  mode: 'production',
  logLevel: 'warn',
  plugins: [keepStylesheets()],
  build: { outDir, sourcemap: 'hidden' }
});

const code = fs.readFileSync(path.join(outDir, file));
const text = code.toString();
const map = JSON.parse(fs.readFileSync(path.join(outDir, `${file}.map`), 'utf8'));

const strings = [];
for (const [id, css] of stylesheets) {
  if (!css) continue;
  const name = path.relative(root, id.slice(0, -'?inline'.length));
  const at = findString(text, css);
  if (at) strings.push([...at, { kind: 'package', name }]);
  else console.warn(`${name} was not found in ${file}; it counts toward the code before it.`);
}

const groups = { package: new Map(), own: new Map() };
const credit = ({ kind, name }, start, end) => {
  if (end <= start) return;
  if (!groups[kind].has(name)) groups[kind].set(name, []);
  groups[kind].get(name).push(text.slice(start, end));
};
const owners = map.sources.map(owner);
const unmapped = { kind: 'package', name: '(not in the map)' };
for (const [start, end, source] of ranges(text, map)) {
  let at = start;
  for (const [from, to, sheet] of strings) {
    if (from >= end || to <= at) continue;
    credit(owners[source] ?? unmapped, at, from);
    credit(sheet, Math.max(at, from), Math.min(end, to));
    at = Math.min(end, to);
  }
  credit(owners[source] ?? unmapped, at, end);
}
const rows = (kind) => [...groups[kind]].map(([name, parts]) => row(name, Buffer.from(parts.join(''))));

console.log(`\n${file}: ${code.length.toLocaleString('en-US')} B, ${gzip(code).toLocaleString('en-US')} B gzip -9`);
console.log('KB gzip compresses each row on its own, so the column adds up to more than the whole.');
const ownCode = row('frontend/ (our own code)', Buffer.from([...groups.own.values()].flat().join('')));
table('By package', [...rows('package'), ownCode], code.length);
table('Our own code, by folder', rows('own'), code.length);
table(
  'Loaded on demand, each a file of its own',
  fs.readdirSync(outDir)
    .filter((name) => name.endsWith(`.${pkg.name}.js`))
    .map((name) => row(name, fs.readFileSync(path.join(outDir, name))))
);
console.log(`\nThe build and its map are in ${outDir}.`);
