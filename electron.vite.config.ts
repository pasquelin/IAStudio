import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { DECODER_MODULES, withoutDecoderUrls } from './src/main/decoder-urls'

const partage = resolve('src/shared')
const principal = resolve('src/main')

/**
 * Strips three.js's decoder URLs so the bundler stops emitting files nothing fetches. The why,
 * and what it weighed, are in `decoder-urls.ts`.
 *
 * Refuses rather than passing the source through: the day three.js writes those URLs differently,
 * a silent no-op puts two megabytes back into the artefact without a single test going red.
 */
function strippedDecoderUrls(): Plugin {
  return {
    name: 'scenario:stripped-decoder-urls',
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

function commitHash(): string {
  // CI hands it over for free; elsewhere ask git, silencing stderr since the catch already
  // handles the failure and `fatal: not a git repository` would only pollute the terminal.
  const fromCi = process.env['GITHUB_SHA']
  if (fromCi) return fromCi.slice(0, 7)

  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // Built from an archive, or without git: a missing hash is no reason to fail the build.
    return 'dev'
  }
}

/**
 * `command` rather than `app.isPackaged`: the dev run renames the Electron bundle AND its
 * executable to the product's name (see `scripts/dev-app-identity.mjs`), and Electron decides
 * `isPackaged` by comparing that executable's basename to `electron`. Renamed, it reports a
 * packaged app in the middle of development — which sent the window looking for `out/renderer`
 * instead of the dev server, and switched six other behaviours to their production side.
 *
 * `serve` is the `dev` command; `build` and `preview` run as `build`.
 */
export default defineConfig(({ command }) => ({
  main: {
    resolve: { alias: { '@shared': partage, '@main': principal } },
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash()),
      __DEV__: JSON.stringify(command === 'serve'),
    },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        // The catalogue's thread, the waveform's process and the recogniser's are entry points
        // of their own: each is resolved beside the bundled main, so each has to land there as
        // a file of its own.
        input: {
          index: resolve('src/main/index.ts'),
          catalogWorker: resolve('src/main/project/catalogWorker.ts'),
          peaksWorker: resolve('src/main/media/peaksWorker.ts'),
          sttWorker: resolve('src/main/dictation/sttWorker.ts'),
        },
        output: { entryFileNames: '[name].js' },
      },
    },
  },
  preload: {
    resolve: { alias: { '@shared': partage } },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        // A sandboxed preload MUST be CommonJS: Electron refuses to load an ESM module, and
        // the `window.studio` bridge is then never installed — silently.
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react(), tailwindcss(), strippedDecoderUrls()],
    resolve: { alias: { '@': resolve('src/renderer/src'), '@shared': partage } },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          splash: resolve('src/renderer/splash.html'),
        },
      },
    },
  },
}))
