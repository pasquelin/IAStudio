import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/** Le banc de synchronisation, hors de `pnpm validate` : c'est une mesure, pas une garde. */
export default defineConfig({
  define: { __DEV__: 'true', __COMMIT_HASH__: JSON.stringify('spike') },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@game': resolve('src/game'),
      '@': resolve('src/renderer/src'),
    },
  },
  test: {
    name: 'spike',
    environment: 'jsdom',
    include: ['spike/webgpu/*.test.ts'],
    setupFiles: ['src/renderer/src/testSetupStores.ts'],
    testTimeout: 600_000,
    css: { include: [/\.css\?raw$/] },
  },
})
