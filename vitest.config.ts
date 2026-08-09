import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@': resolve('src/renderer/src'),
}

export default defineConfig({
  // Injected by `define` in electron.vite.config.ts, so a module reaching for one under vitest
  // would throw a bare ReferenceError. Development is the truthful answer here: the tests are
  // the dev run.
  define: {
    __DEV__: 'true',
    __COMMIT_HASH__: JSON.stringify('test'),
  },
  test: {
    // Without `include`, a file no test imports is absent from the report — deleting its tests
    // would RAISE the percentage. Budgets of uncovered items, not percentages: the same
    // percentage buys a handful of statements in a small module and hundreds in a large one,
    // and widens on its own as well-covered files land. Only the modules the checklist names.
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.bench.ts', '**/*-fixtures.ts', '**/test-harness.ts', '**/fake-bridge.ts'],
      reporter: ['text-summary', 'html'],
      // Negative = how many uncovered statements/branches a module may carry. Sized per module
      // rather than by one rule: a glob whose room to grow is mostly untestable GPU needs a
      // wider budget than one made of state machines, or growth alone would break it.
      //
      // A glob matching nothing passes silently. Renaming a folder turns its budget into a
      // no-op, and a new `engines/` subfolder lands under no budget at all — both without a
      // warning. These names follow `src/`; keep them in step.
      thresholds: {
        'src/shared/**': { statements: -6, branches: -20 },
        'src/main/settings/**': { statements: -30, branches: -12 },
        // Raised by five for `assetBackendOf`, the asset half of the SDK adapter: like
        // `model-catalog` and `runner` beside it, it is pure delegation that no test can reach
        // without standing up a whole `Scenario`. Everything with logic in it took a port instead.
        'src/main/scenario/**': { statements: -85, branches: -70 },
        'src/main/project/**': { statements: -115, branches: -60 },
        'src/main/media/**': { statements: -70, branches: -32 },
        // Where the library meets the disk. Tight on purpose: nothing here needs a GPU or a
        // network, so what is not covered is what nobody got round to, not what cannot be run.
        'src/main/assets/**': { statements: -10, branches: -10 },
        'src/renderer/src/stores/**': { statements: -90, branches: -82 },
        // Split from the GPU below: together, five files jsdom cannot run held 55 % of one
        // budget, so a new render pass ate the room that guarded the state machines.
        'src/renderer/src/engines/{timeline,canvas,audio,core}/**': {
          statements: -270,
          branches: -250,
        },
        'src/renderer/src/engines/{scene,skybox,viewport,texture,gpu}/**': {
          statements: -700,
          branches: -310,
        },
        // Both at zero: the diagnostics channel is the studio's only trace of a failure that has
        // no surface, and a branch of it nobody exercises is a failure nobody would ever read.
        'src/main/diagnostics/**': { statements: 0, branches: 0 },
        'src/renderer/src/services/**': { statements: 0, branches: 0 },
        // Kept tight for the same reason: an update downloads itself and `quitAndInstall` is
        // irreversible, so a branch nobody exercises is one nobody would see go wrong either.
        'src/main/{updater.ts,update/**}': { statements: -3, branches: -1 },
        'src/renderer/src/helpers/**': { statements: -30, branches: -28 },
        'src/renderer/src/hooks/**': { statements: -38, branches: -20 },
        // The renderer half of project-file serialization; `src/main/project/**` guards the other.
        'src/renderer/src/app/document-io.ts': { statements: -14, branches: -6 },
        'src/renderer/src/app/UpdateStatus.tsx': { statements: 0, branches: 0 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{main,preload,shared}/**/*.test.ts'],
          setupFiles: ['src/main/test-setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          // Stylesheets are stubbed to an empty string by default, `?raw` included — which
          // silently empties the checks that read a rule back. Only the raw reads are spared;
          // nothing that a component imports for its styles is processed.
          css: { include: [/\.css\?raw$/] },
          setupFiles: ['src/renderer/src/test-setup.ts'],
        },
      },
    ],
  },
})
