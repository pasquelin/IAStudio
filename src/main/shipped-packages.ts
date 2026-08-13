/**
 * The npm packages that reach a user's disk: bundled by Vite, loaded at runtime, or shipped
 * beside. Not here on purpose: eslint, prettier, vitest, typescript, electron-builder and the
 * `@types` — a build tool never leaves the machine that ran it.
 *
 * Spelled out rather than derived from `dependencies`: this project bundles React, zustand,
 * dockview and the rest with Vite, so they sit in `devDependencies` while shipping in the binary
 * all the same. Deriving from the manifest would quietly omit most of the notice.
 *
 * Under `src/main` for the reason `coverage-budgets.ts` gives: it describes what the repository
 * root ships, and `src/shared` compiles for the renderer, which has no use for the list. Nothing
 * of the application imports it — `scripts/collect-licences.mjs` does, and so does
 * `licences.test.ts`, so the list the tests check is the one the collector reads.
 */
export const SHIPPED: string[] = [
  // Runtime dependencies, loaded from `node_modules` by the main process.
  '@mdi/js',
  '@mdi/react',
  '@scenario-labs/sdk',
  '@xyflow/react',
  'better-sqlite3',
  'electron-store',
  'electron-updater',
  'mediabunny',
  'opentype.js',
  'pixi.js',
  'sherpa-onnx-node',
  'three',
  'three-mesh-bvh',
  // The runtime itself.
  'electron',
  // Bundled into the renderer by Vite, hence in `devDependencies` while shipping all the same.
  '@hookform/resolvers',
  '@tanstack/react-query',
  '@tanstack/react-virtual',
  'daisyui',
  'dockview-react',
  'i18next',
  'immer',
  'react',
  'react-dom',
  'react-hook-form',
  'react-i18next',
  'react-is',
  'react-tooltip',
  'recharts',
  'tailwind-merge',
  'tailwindcss',
  'wavesurfer.js',
  'zod',
  'zustand',
]
