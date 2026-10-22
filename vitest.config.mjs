import { defineConfig } from 'vitest/config';
import { jsxInJs } from './build/plugins.mjs';

// vite.config.mjs is not merged in: a run needs neither the bundle nor the dev server.
export default defineConfig({
  plugins: [jsxInJs()],
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
    // Files mock axios and stub window, so each gets its own worker. Set, not left to default, so
    // Vitest stops suggesting otherwise.
    isolate: true,
    // The cache lives in node_modules, which CI deletes before every install.
    fsModuleCache: false
  }
});
