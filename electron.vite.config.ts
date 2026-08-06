import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'

const partage = resolve('src/shared')
const principal = resolve('src/main')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': partage, '@main': principal } },
    build: { externalizeDeps: true, rollupOptions: { input: resolve('src/main/index.ts') } },
  },
  preload: {
    resolve: { alias: { '@shared': partage } },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        // Un preload sandboxé DOIT être en CommonJS : Electron refuse de charger un module
        // ESM, et le pont `window.studio` n'est alors jamais posé — en silence.
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve('src/renderer/src'), '@shared': partage } },
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
})
