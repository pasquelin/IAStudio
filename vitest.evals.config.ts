import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * The bench, which is not the suite: it spends money, needs a key and answers differently twice
 * in a row. `pnpm validate` must be none of those, so it has a config of its own and a file
 * suffix `pnpm test` never picks up.
 */
/**
 * The key lives in `secret/.env`, a folder git does not carry — so a bench is one command rather
 * than one command and a secret pasted each time, and the secret never reaches a commit.
 *
 * `''` as the prefix: `loadEnv` hands back only `VITE_`-prefixed names otherwise, and these are
 * read by the bench in the Node process rather than by a browser.
 */
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
    include: ['scripts/evals/**/*.eval.ts'],
    // One at a time: the figures are what the bench is for, and a queue at the door skews them.
    fileParallelism: false,
    env,
  },
})
