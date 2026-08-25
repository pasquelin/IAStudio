import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * The bench, which is not the suite: it spends money, needs a key and answers differently twice
 * in a row. `pnpm validate` must be none of those, so it has a config of its own and a file
 * suffix `pnpm test` never picks up.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@': resolve('src/renderer/src'),
    },
  },
  test: {
    include: ['scripts/evals/**/*.eval.ts'],
    // One at a time: the figures are what the bench is for, and a queue at the door skews them.
    fileParallelism: false,
  },
})
