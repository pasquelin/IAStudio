import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@': resolve('src/renderer/src'),
}

export default defineConfig({
  // Injected by `define` in electron.vite.config.ts, so a module reaching for one under vitest
  // would throw a bare ReferenceError. Development is the truthful answer here: the tests are
  // the dev run.
  define: {
    __DEV__: 'true',
    __COMMIT_HASH__: JSON.stringify('test'),
  },
  test: {
    /**
     * Floors, not targets, and only where a regression would cost something: the IPC contract,
     * the stores and their undo history, the pure part of the engines, the project files.
     * No global threshold — one turns "cover what matters" into "write a test for the getter".
     *
     * `include` is what makes them mean anything. Without it a file no test imports is simply
     * absent from the report, so deleting its tests RAISES the percentage. Counting everything
     * moved the honest figure from 88 % to 76 %; these floors sit under the second one.
     */
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.bench.ts', 'src/**/test-setup.ts'],
      thresholds: {
        'src/shared/**': { statements: 97, branches: 90 },
        'src/main/settings/**': { statements: 87, branches: 88 },
        'src/main/scenario/**': { statements: 83, branches: 82 },
        'src/main/project/**': { statements: 72, branches: 72 },
        'src/main/media/**': { statements: 81, branches: 83 },
        'src/renderer/src/stores/**': { statements: 82, branches: 71 },
        'src/renderer/src/engines/**': { statements: 70, branches: 66 },
        'src/renderer/src/helpers/**': { statements: 88, branches: 83 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{main,preload,shared}/**/*.test.ts'],
          setupFiles: ['src/main/test-setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          // Stylesheets are stubbed to an empty string by default, `?raw` included — which
          // silently empties the token check. Only the raw read is spared; nothing that a
          // component imports for its styles is processed.
          css: { include: [/index\.css\?raw$/] },
          setupFiles: ['src/renderer/src/test-setup.ts'],
        },
      },
    ],
  },
})
