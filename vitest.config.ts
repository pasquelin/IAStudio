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

/**
 * The zone every suite reads its clocks in, so a date test answers the same everywhere.
 *
 * Left to the machine, a test about time passes for whoever wrote it and fails for the next reader.
 * Measured before fixing it: the whole suite is green under `UTC` and under `Asia/Tokyo` alike.
 *
 * **What depends on this pin is any case asserting a LOCAL reading**, not a number of them: this
 * paragraph said "exactly one case" and a review counted three, across two files. A count drifts
 * the moment another case leans on the pin, and it sends the next reader to the wrong file.
 *
 * Tokyo rather than UTC, and rather than Paris. **Not UTC**: a zone at zero offset makes every
 * assertion about zones agree by accident, which is the defect the case above exists to catch.
 * **Not Paris**: it observes daylight saving, so a stamp near midnight changes day twice a year
 * and a suite green in August goes red in November. `Asia/Tokyo` is UTC+9 all year.
 *
 * **Set on this process, NOT through a project's `env` block** — measured, and the difference is
 * the whole reason this paragraph exists. `env: { TZ }` reaches the worker after Node has already
 * resolved its zone, so the case above still read the machine's and still failed under `TZ=UTC`.
 * Assigning it here runs while the config is evaluated, before any worker is spawned, so every
 * pool inherits it.
 */
const TEST_TZ = 'Asia/Tokyo'

process.env.TZ = TEST_TZ

/**
 * Worker threads, where Vitest defaults to child processes since its version 2. What it buys is the
 * start of each worker: a process costs more than a thread, and this suite pays that once per
 * worker either way.
 *
 * Two paired series on 2026-08-12, CPU (user+sys), and they DISAGREE on how much:
 *
 *   under load ~110 : 400 s → 347 s   (−13 %)
 *   under load ~40  : 486 s → 447 s   (−8 %)
 *
 * The direction held in both and in every pair; the size did not. Read this as "somewhere between
 * eight and thirteen percent, on a machine shared with other work" rather than as a figure — a
 * single number here would be the one a later reader trusts.
 *
 * `forks` is what a native module that is not thread-safe demands, and ONE such module is reached
 * by the suites: `node:sqlite`. It is a native binding like any other, experimental at that — the
 * first `pnpm validate` with threads on all three projects ended in SIGSEGV. `better-sqlite3` is
 * NOT the one: only `sqlite-native.ts` imports it, which only `catalog-worker` loads. The
 * dictation addon sits behind a `utilityProcess` no test starts.
 *
 * Hence `forks` on the `node` project alone. Its effect is what a review measured, and it is the
 * mechanism rather than the crash: counting the PIDs that log `ExperimentalWarning: SQLite`, the
 * twelve loads happen in TWELVE processes here, against ONE process on twelve threads when all
 * projects use threads. **It does NOT prevent the crash, and that is now measured rather than
 * doubted**: on 2026-08-13, one whole-suite run in fifty ended in `EXIT=139` — SIGSEGV, twelve
 * processes killed mid-flight, no summary printed. Cumulative rate under the parade: **1 in 81**.
 * An insurance, not a fix.
 *
 * **What the hunt for it established, so that nobody pays for it twice** — two series of 25 runs,
 * one crash in the first, none in the second:
 * - macOS wrote **no crash report** for it (`~/Library/Logs/DiagnosticReports`, empty at that
 *   minute while `node` reports from other days sit right there). There is no stack to read.
 * - `node:sqlite` is the suspect the paragraph above names, and nothing measured incriminates it.
 *   Its warnings were the only thing on screen because **nothing else prints before the summary**,
 *   which designates it no more than any other module.
 * - The concrete hypothesis was tested and is dead: 500 `DatabaseSync` opened without `close()`
 *   and finalised under a forced GC, five times, crash none. The native finaliser is not it.
 *
 * At one in eighty-one, with no report and no isolated repro, **catching it in the act costs more
 * than waiting for it**. Reopen only with a mechanism in hand, never with more runs.
 *
 * Stated per project, and that is not redundancy: a project inherits nothing from the root `test`
 * block unless it says `extends`, and none here does. A review asked each project which side it
 * runs on: with the pool set at the root alone, all three answer `child_process`.
 */
const TEST_POOL = 'threads'

/**
 * The renderer tests that must keep a browser, established by RUNNING them under `node` rather
 * than by reading them — on 2026-08-12, 247 files, of which 43 failed. Grepping for `document.`
 * would have named 39 and missed the ones whose need is transitive: a store reaching a module
 * that touches `window`, a helper that walks an element.
 *
 * One entry PASSES under node and is here anyway; its own note says why. Passing is not the whole
 * test, which is why no count of "the ones that fail" governs this list.
 *
 * They are the exception, so they are the list: a new `.test.ts` lands in the fast project and
 * FAILS loudly if it needs a browser, which its author sees at once. Listing the others instead
 * would leave every new file in jsdom, and nobody would notice.
 *
 * A file leaves this list the day it stops needing a DOM — nothing measures that on its own, and
 * a stale entry costs only the second it wastes.
 */
const DOM_BOUND = [
  'src/renderer/src/app/document-io.test.ts',
  // Imports the definition of all twenty-one panels, so it loads every panel component. It
  // PASSES under node — and covers less: the branches those modules run at import take the
  // other path without a browser, and `panels/**` went four branches over its budget.
  'src/renderer/src/app/tool-components.test.ts',
  'src/renderer/src/app/unsaved-guard.test.ts',
  'src/renderer/src/dictation/insert-at-caret.test.ts',
  'src/renderer/src/engines/audio/audio-render.test.ts',
  'src/renderer/src/engines/canvas/CanvasEngine.test.ts',
  'src/renderer/src/engines/canvas/CanvasOverlay.test.ts',
  'src/renderer/src/engines/core/canvas-2d.test.ts',
  'src/renderer/src/engines/core/palette.test.ts',
  'src/renderer/src/engines/scene/animation-painter.test.ts',
  'src/renderer/src/engines/scene/bvh-builder.test.ts',
  'src/renderer/src/engines/scene/bvh.worker.test.ts',
  'src/renderer/src/engines/scene/node-kinds.test.ts',
  'src/renderer/src/engines/scene/pane-dress.test.ts',
  'src/renderer/src/engines/scene/pane-materials.test.ts',
  'src/renderer/src/engines/scene/scene-export.test.ts',
  'src/renderer/src/engines/scene/scene-models.test.ts',
  'src/renderer/src/engines/scene/scene-renderer-animation.test.ts',
  'src/renderer/src/engines/scene/scene-renderer-export.test.ts',
  'src/renderer/src/engines/scene/scene-renderer-loaders.test.ts',
  'src/renderer/src/engines/scene/scene-renderer-sync.test.ts',
  'src/renderer/src/engines/scene/three-factory.test.ts',
  'src/renderer/src/engines/skybox/SkyboxRenderer.test.ts',
  'src/renderer/src/engines/texture/TextureRenderer.test.ts',
  'src/renderer/src/engines/timeline/TimelineEngine.mount.test.ts',
  'src/renderer/src/engines/timeline/painter.test.ts',
  'src/renderer/src/engines/viewport/ViewportEngine.test.ts',
  'src/renderer/src/helpers/menu-icon.test.ts',
  // Not for a DOM of their own: they read the labels a menu is raised with, and `i18next` is only
  // initialised by the renderer setup — `initI18n` reads `localStorage`, which node has not.
  'src/renderer/src/panels/assets/AssetMenu.test.ts',
  'src/renderer/src/panels/layers/LayerMenu.test.ts',
  'src/renderer/src/spaces/three/SceneNodeMenu.test.ts',
  'src/renderer/src/helpers/model-for-family.test.ts',
  'src/renderer/src/helpers/plan-access.test.ts',
  'src/renderer/src/helpers/scroll-parent.test.ts',
  'src/renderer/src/helpers/tool-registry.test.ts',
  'src/renderer/src/helpers/typing.test.ts',
  'src/renderer/src/home/use-explore.test.ts',
  'src/renderer/src/hooks/useCostEstimate.test.ts',
  'src/renderer/src/hooks/useLoadable.test.ts',
  'src/renderer/src/hooks/useShortcutLabel.test.ts',
  'src/renderer/src/i18n/index.test.ts',
  'src/renderer/src/spaces/image/image-tools.test.ts',
  'src/renderer/src/spaces/textures/derive-channel.test.ts',
  'src/renderer/src/spaces/three/scene-tools.test.ts',
  'src/renderer/src/spaces/video/video-tools.test.ts',
  'src/renderer/src/stores/dictation.test.ts',
  'src/renderer/src/stores/documents.test.ts',
  'src/renderer/src/stores/layouts.test.ts',
  'src/renderer/src/stores/models.test.ts',
  'src/renderer/src/test-setup.test.ts',
]

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
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          // Repeated from the root block, which a project does NOT inherit: three guards that
          // parse a whole folder failed announcing `timed out in 5000ms` under a config saying
          // fifteen. The root value governs no project, so every project states its own.
          // `forks` here, and only here: the suites bind `node:sqlite`, which is a native binding
          // like any other. A whole-suite run under threads segfaulted once — see TEST_POOL.
          pool: 'forks',
          testTimeout: TEST_TIMEOUT,
          include: ['src/{main,preload,shared}/**/*.test.ts'],
          // Anchored like the line above, and for a reason `include` alone does not cover: the
          // benchmark glob is a SEPARATE setting with its own default, `**/*.bench.*`, which is
          // not anchored at all. Left to it, `pnpm bench` walked into `.claude/worktrees/` and
          // measured the branches of other sessions — 72 lines of another checkout's numbers,
          // presented as this one's.
          benchmark: { include: ['src/{main,preload,shared}/**/*.bench.ts'] },
          setupFiles: ['src/main/test-setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          pool: TEST_POOL,
          testTimeout: TEST_TIMEOUT,
          // Every component test, plus the `.test.ts` that were measured to need a browser.
          include: ['src/renderer/**/*.test.tsx', ...DOM_BOUND],
          // The same split as the tests, and it has to be stated: a project with no benchmark
          // glob of its own keeps the unanchored default and runs EVERY bench of the tree —
          // this one was measuring the main process's, under jsdom, on top of the `node` project
          // already doing it. No `.bench.tsx` exists today; the day one does, it lands here.
          benchmark: { include: ['src/renderer/**/*.bench.tsx'] },
          // Stylesheets are stubbed to an empty string by default, `?raw` included — which
          // silently empties the checks that read a rule back. Only the raw reads are spared;
          // nothing that a component imports for its styles is processed.
          css: { include: [/\.css\?raw$/] },
          setupFiles: ['src/renderer/src/test-setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'renderer-node',
          // The renderer tests that never touch a browser. jsdom and the renderer setup cost them
          // more than they run: on 2026-08-12, 221 cases of `helpers/` executed in 700 ms under
          // 45.9 s of environment and 26.9 s of setup. Three alternating pairs over the same
          // sample: 32.9 s of jsdom against 16.7 s here.
          environment: 'node',
          pool: TEST_POOL,
          testTimeout: TEST_TIMEOUT,
          include: ['src/renderer/**/*.test.ts'],
          // The three renderer benchmarks, anchored for the reason the `node` project gives.
          benchmark: { include: ['src/renderer/**/*.bench.ts'] },
          exclude: DOM_BOUND,
          // The half of the renderer setup that needs no browser. Without it these suites kept
          // the defect the DOM ones were cured of, and each had to write its own reset.
          setupFiles: ['src/renderer/src/test-setup-stores.ts'],
          // Three files read a stylesheet back through `?raw` and fail without this, which is how
          // it was found: they are not DOM-bound, they were parser-bound.
          css: { include: [/\.css\?raw$/] },
        },
      },
    ],
  },
})
