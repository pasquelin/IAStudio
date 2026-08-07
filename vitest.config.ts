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
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{main,preload,shared}/**/*.test.ts'],
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
