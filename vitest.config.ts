import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@': resolve('src/renderer/src'),
}

/**
 * Three times the default. A rendering case with `userEvent` takes a few hundred milliseconds
 * on an idle machine and several times that when the whole suite runs across every core — two
 * of them started timing out at five seconds as the suite grew, and neither was slow for a
 * reason anyone could act on. Long enough to tell a busy machine from a wedged test.
 *
 * Named because every project below has to repeat it: a project inherits nothing from the root
 * `test` block, so the value written once governed nothing.
 */
const TEST_TIMEOUT = 15_000

export default defineConfig({
  // Injected by `define` in electron.vite.config.ts, so a module reaching for one under vitest
  // would throw a bare ReferenceError. Development is the truthful answer here: the tests are
  // the dev run.
  define: {
    __DEV__: 'true',
    __COMMIT_HASH__: JSON.stringify('test'),
  },
  test: {
    testTimeout: TEST_TIMEOUT,
    // Without `include`, a file no test imports is absent from the report — deleting its tests
    // would RAISE the percentage. Budgets of uncovered items, not percentages: the same
    // percentage buys a handful of statements in a small module and hundreds in a large one,
    // and widens on its own as well-covered files land. Only the modules the checklist names.
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.bench.ts',
        // `.tsx` too, so this draws the line the two text guards draw.
        '**/*-fixtures.ts',
        '**/*-fixtures.tsx',
        '**/test-harness.ts',
        '**/fake-bridge.ts',
      ],
      reporter: ['text-summary', 'html'],
      // Negative = how many uncovered statements/branches a module may carry. Sized per module
      // rather than by one rule: a glob whose room to grow is mostly untestable GPU needs a
      // wider budget than one made of state machines, or growth alone would break it.
      //
      // The sign is the whole meaning: a threshold `>= 0` is read as a minimum PERCENTAGE, so a
      // budget of zero cannot be written and a glob covered whole says `100`. Guarded by
      // `src/main/coverage-thresholds.test.ts`, which tells what it cost.
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
        //
        // Raised again for the CEL evaluator's two plumbing files, which is the allowance
        // `dictation` already grants `stt-worker` for the same reason: `transform-worker` reads
        // `parentPort` and `transform-thread` calls `new Worker`, so neither runs without a real
        // thread. What DECIDES anything sits beside them and is covered whole — `runTransform`
        // is pure and has its own suite, and `transform-client` holds the deadline that kills a
        // runaway evaluation, tested against a port the suite drives by hand.
        'src/main/scenario/**': { statements: -112, branches: -82 },
        'src/main/project/**': { statements: -115, branches: -60 },
        'src/main/media/**': { statements: -70, branches: -32 },
        // The recognition engine and what feeds it. Three files here cannot be reached by a
        // test and account for nearly all of the allowance: `stt-worker` loads a native addon
        // at import, `stt-process` forks a `utilityProcess`, and `model-store` is the real
        // network and the real disk. Everything that decides anything — the protocol, the
        // download, the session's states, the segmenting — sits beside them and is covered.
        'src/main/dictation/**': { statements: -140, branches: -60 },
        // The window's half. Most of what is left uncovered is `capture.ts`: jsdom has no
        // `getUserMedia` and no audio graph, so what it does can only be watched in the
        // application. Everything it hands over — the conversions, the insertion at the caret,
        // the store — is covered here.
        'src/renderer/src/dictation/**': { statements: -55, branches: -34 },
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
        // Raised for the film pass: `renderFilm` draws off screen and reads pixels back, which
        // no jsdom run reaches at all — the only case the comment above allows a budget to grow
        // for. What it schedules and how its pixels come back are covered apart, in `film.ts`.
        //
        // Raised again, by eight then by three, for the four-view layout: what is left
        // uncovered is `SceneRenderer.placePanes` aiming real cameras and `dressPane` running
        // from the render loop, neither of which exists without a WebGL context. The rules they
        // apply do NOT live there — `pane-dress.ts`, `pane-materials.ts` and `panes.ts` were
        // split out for exactly this reason and are covered whole, as is every camera swap in
        // `ViewportEngine`. What remains is the wiring between them — and the wiring grew again
        // when the picking and the gizmo started following the view under the pointer, which is
        // reachable only from a canvas that draws.
        // Raised again by the pose mode: `projectedBones`, `pickedBoneObject` and `boneRestOf`
        // all read a live three object out of a mounted scene, which is exactly what jsdom has
        // none of. The RULE they serve was split out and is covered whole — `bone-picking.ts`
        // decides which bone a point names, and its nine cases include the two that mattered
        // (a bone behind the camera, two bones projecting to the same spot).
        'src/renderer/src/engines/{scene,skybox,viewport,texture,gpu}/**': {
          statements: -790,
          branches: -415,
        },
        // Tight, like `main/assets` and for the same reason: nothing here needs a GPU, a network
        // or a DOM, so what is uncovered is what nobody got round to. Nearly all of it is the
        // fallback arm of a `Map.get` that a topological order makes unreachable, which
        // `noUncheckedIndexedAccess` requires anyway.
        // The executor holds TWO of that same arm, and both are the node behind an id the plan
        // just handed back, which cannot be missing from the graph the plan was built on:
        // `settledOn`'s `?? STALLED` and the `if (!node) continue` of the run loop. Measured
        // unreachable rather than assumed — `planGraph` filters the dangling edges and only
        // reports `ok` when every node was ordered, so `settled` holds an entry for each.
        'src/renderer/src/engines/graph/**': { statements: -19, branches: -26 },
        // Both covered whole: the diagnostics channel is the studio's only trace of a failure
        // that has no surface, and a branch of it nobody exercises is a failure nobody would
        // ever read.
        'src/main/diagnostics/**': { statements: 100, branches: 100 },
        'src/renderer/src/services/**': { statements: 100, branches: 100 },
        // Kept tight for the same reason: an update downloads itself and `quitAndInstall` is
        // irreversible, so a branch nobody exercises is one nobody would see go wrong either.
        'src/main/{updater.ts,update/**}': { statements: -3, branches: -1 },
        'src/renderer/src/helpers/**': { statements: -30, branches: -28 },
        'src/renderer/src/hooks/**': { statements: -38, branches: -20 },
        // The renderer half of project-file serialization; `src/main/project/**` guards the other.
        'src/renderer/src/app/document-io.ts': { statements: -14, branches: -6 },
        'src/renderer/src/app/UpdateStatus.tsx': { statements: 100, branches: 100 },
        // The three globs that had no budget at all, which is how five new files landed in them
        // without a threshold moving. Set to what they measure today, not to a round number:
        // a budget above what a glob carries is room nobody decided to grant. What sits under
        // them is what jsdom cannot run — a canvas, a WebGL context, a drag — plus, in `panels`,
        // the branches of a shelf that needs a project open.
        'src/renderer/src/app/**': { statements: -48, branches: -26 },
        // Raised for the animation band: its playback loop is a `requestAnimationFrame` that
        // no jsdom run turns, and the render button's work belongs to the engine behind it.
        //
        // Raised again by the dope sheet, and for the same kind of reason: `AnimationCanvas`
        // paints into a 2D context jsdom does not provide, and its wheel handler is a native
        // non-passive listener no `userEvent` gesture reaches. What CAN be reached was, and is
        // — the drag of a key and of a block, the scrub, the picking, and every switch of the
        // header column, each in a test of its own.
        'src/renderer/src/panels/**': { statements: -215, branches: -175 },
        'src/renderer/src/design/**': { statements: -59, branches: -66 },
        // The fourth glob that had none, found the day a lot posted `GraphStatus.tsx` into it and
        // nothing moved. Measured at 235 and 195 the day it was set — what the six spaces carry,
        // which is mostly what jsdom cannot run: a WebGL viewport, a Pixi brush, a React Flow
        // canvas laid out at zero. Not a round number, and not room anyone decided to grant.
        'src/renderer/src/spaces/**': { statements: -235, branches: -195 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          // Repeated from the root block, which a project does NOT inherit: three guards that
          // parse a whole folder failed announcing `timed out in 5000ms` under a config saying
          // fifteen. The root value governs no project, so every project states its own.
          testTimeout: TEST_TIMEOUT,
          include: ['src/{main,preload,shared}/**/*.test.ts'],
          setupFiles: ['src/main/test-setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          testTimeout: TEST_TIMEOUT,
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
