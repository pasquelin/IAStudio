import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * The bench, which is not the suite: it spends money, needs a key and answers differently twice
 * in a row — hence a config of its own and a suffix `pnpm test` never picks up.
 */

/** From `secret/.env`, which git does not carry. `''` as the prefix: these are read in Node. */
const env = loadEnv('test', resolve('secret'), '')

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@': resolve('src/renderer/src'),
    },
  },
  test: {
    include: ['scripts/banc/**/*.banc.ts'],
    // jsdom and the store setup, like the `scripts` project of the suite: the bench drives the
    // REAL renderer handlers, and the stores they read are written for a window.
    environment: 'jsdom',
    setupFiles: ['src/renderer/src/testSetupStores.ts'],
    // One at a time: the figures are what the bench is for, and a queue at the door skews them.
    fileParallelism: false,
    env,
  },
})
