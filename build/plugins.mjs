import path from 'node:path';
import { transformWithOxc } from 'vite';

const frontend = path.resolve(import.meta.dirname, '..', 'frontend') + path.sep;

// JSX in frontend/'s `.js` files, compiled to classic React.createElement.
export const jsxInJs = () => ({
  name: 'perun-core:jsx-in-js',
  enforce: 'pre',
  transform(code, id) {
    if (!id.startsWith(frontend) || !id.endsWith('.js')) return null;
    return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'classic' } });
  }
});

// Each imported stylesheet becomes its own <style> in <head>, in import order:
// pages load only the script, so an extracted .css file would never load.
export function stylePerSheet() {
  // Must not end in `.css`, or Vite's CSS plugin claims the module.
  const STYLE = '\0perun-core-style:';
  const AS_JS = '.js';
  const INSERT = '\0perun-core-style-insert';

  return {
    name: 'perun-core:style-per-sheet',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === INSERT) return INSERT;
      if (!importer || !source.endsWith('.css')) return null;
      if (source.endsWith('.module.css')) {
        this.error(`${importer} imports the CSS module ${source}. This build inserts each sheet as it is (see stylePerSheet in build/plugins.mjs) and has no CSS modules; use a plain sheet with the class names written out.`);
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
    // Drops the sheet's sourceMappingURL: bootstrap.min.css names a .map that
    // isn't vendored, and DevTools logs the 404.
    transform(code, id) {
      if (!id.endsWith('.css?inline')) return null;
      return { code: code.replace(/\n?\/\*# sourceMappingURL=[^*]*\*\/\s*$/, ''), map: null };
    }
  };
}
