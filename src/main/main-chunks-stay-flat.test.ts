import { describe, expect, it } from 'vitest'
import config from '../../electron.vite.config'

/**
 * That a module the bundler MOVES keeps resolving the same paths.
 *
 * 🛑 Eight sites of `src/main` derive a path from their own file — the icon and every bundled
 * resource, the preload a window loads, the renderer, and the four worker entries. Rollup lifts
 * whatever it likes into a shared chunk, and a chunk one directory deeper sends every one of
 * those one directory too far. Measured 2026-08-26, splitting the studio's start-up out of
 * `index.ts`: the studio died on `out/build/icon.png`, with the whole gate green.
 *
 * Read off the CONFIG OBJECT and not its text: the same two lines pasted into the renderer's
 * block, or moved out of `output`, would leave a text search green.
 */
const output = (): Record<string, unknown> => {
  const resolved =
    typeof config === 'function' ? config({ command: 'build', mode: 'production' }) : config
  const main = (
    resolved as { main: { build: { rollupOptions: { output: Record<string, unknown> } } } }
  ).main
  return main.build.rollupOptions.output
}

describe('what the bundler emits for the main process', () => {
  /** Flat, so a chunk sits where the entry it was split from sits. */
  it('puts a chunk beside the entry rather than under a folder of its own', () => {
    expect(output()['chunkFileNames']).toBe('[name]-[hash].js')
  })

  /** The four workers are reached BY NAME — `new URL('./bundleWorker.js', import.meta.url)`. */
  it('leaves every entry under the name its caller spells', () => {
    expect(output()['entryFileNames']).toBe('[name].js')
  })
})
