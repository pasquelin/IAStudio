import { defineConfig } from 'vite'
import { basename, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { DECODER_MODULES, withoutDecoderUrls } from './src/main/decoderUrls'

/**
 * The runtime an EXPORTED game ships — one ES module, no studio, no React, no Electron.
 *
 * 🛑 Its own config rather than a third entry of `electron.vite.config.ts`: that one builds the
 * studio's window with Tailwind and the React plugin, and a game must carry none of it. What
 * keeps the two apart is `main/export-imports.test.ts`, which sweeps what the entry reaches.
 */
function strippedDecoderUrls(): Plugin {
  return {
    name: 'provider:stripped-decoder-urls',
    transform(source, id) {
      if (!DECODER_MODULES.includes(basename(id))) return null

      const code = withoutDecoderUrls(source)
      if (code === source) {
        throw new Error(`${basename(id)} names no '../libs/' decoder URL — the rewrite is stale`)
      }
      return { code, map: null }
    },
  }
}

export default defineConfig({
  plugins: [strippedDecoderUrls()],
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@game': resolve('src/game'),
      '@shared': resolve('src/shared'),
    },
  },
  build: {
    outDir: resolve('resources/gameRuntime'),
    emptyOutDir: true,
    // A library, not a page: the page an export writes imports `./runtime.js` by name.
    lib: {
      entry: resolve('src/renderer/src/game/exportEntry.ts'),
      formats: ['es'],
      fileName: () => 'runtime.js',
    },
  },
})
