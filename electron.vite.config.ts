import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const partage = resolve('src/shared')
const principal = resolve('src/main')

function commitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    // Built from an archive, or without git: a missing hash is no reason to fail the build.
    return 'dev'
  }
}

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': partage, '@main': principal } },
    define: { __COMMIT_HASH__: JSON.stringify(commitHash()) },
    build: { externalizeDeps: true, rollupOptions: { input: resolve('src/main/index.ts') } },
  },
  preload: {
    resolve: { alias: { '@shared': partage } },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          splash: resolve('src/preload/splash.ts'),
        },
        // A sandboxed preload MUST be CommonJS: Electron refuses to load an ESM module, and
        // the `window.studio` bridge is then never installed — silently.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react(), tailwindcss()],
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
})
