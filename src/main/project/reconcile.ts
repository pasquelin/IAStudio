import { IDLE_RESCAN, type RescanState } from '@shared/domain/project'
import type { RescanProgress, RescanReport } from './catalog-rescan'
import type { AsyncCatalog } from './catalog-client'

export type ReconcilerDeps = {
  /** The open project, or null. Read per pass: a project can close while one is running. */
  rootOf: () => string | null
  catalogOf: () => AsyncCatalog | null
  announce: (state: RescanState) => void
  /** One line, once a pass has actually changed something. */
  report: (report: RescanReport) => void
  warn: (error: unknown) => void
  /** Milliseconds, injected so the interval below is a value a test can move. */
  clock?: () => number
}

/**
 * The shortest gap between two passes. Long enough that a burst of focus events is one walk,
 * short enough that coming back from the Finder having moved a file feels immediate — the
 * gesture takes longer than this to make.
 */
const MIN_INTERVAL_MS = 5_000

export type Reconciler = {
  /**
   * Asks for a pass, and may well do nothing: one already running is not queued behind itself,
   * one that has just finished is not run again straight away, and there is nothing to walk
   * with no project open. Every caller asks and moves on.
   */
  request: () => void
  /** Stops the pass that is running, if any. What it had already written stays written. */
  stop: () => void
  /** The state a window that has just opened should be shown. */
  state: () => RescanState
}

/**
 * Keeps the catalogue and the project folder in agreement, and decides WHEN.
 *
 * Two moments, and they are not the same one: opening a project catches what moved while the
 * studio was closed, and the window coming back to the front catches what moved while it was
 * open — the Finder is the other half of every project folder. Neither is enough alone.
 *
 * **One pass at a time.** A window regaining focus twice in a second must not walk the project
 * twice; the second ask is dropped rather than queued, because the pass that is running will
 * read the same disk the second one would have.
 *
 * The pass itself runs in the catalogue's thread — the walk, the fingerprints and the writes all
 * happen there. What lives here is the policy, which is why it holds no `fs` at all.
 */
export function createReconciler({
  rootOf,
  catalogOf,
  announce,
  report,
  warn,
  clock = () => Date.now(),
}: ReconcilerDeps): Reconciler {
  let running: AbortController | null = null
  let state: RescanState = IDLE_RESCAN
  // Far enough back that the first ask — a project opening — is never held off.
  let lastRunAt = Number.NEGATIVE_INFINITY
  let lastRoot: string | null = null

  const publish = (next: RescanState): void => {
    state = next
    announce(next)
  }

  return {
    state: () => state,

    stop: () => running?.abort(),

    request: () => {
      if (running) return

      const root = rootOf()
      const catalog = catalogOf()
      if (!root || !catalog) return

      // ANOTHER project is always worth a pass, whatever the interval says: its folder has never
      // been held against its catalogue, and the interval is about a burst of focus events on
      // one project rather than about how recently the studio did any work at all.
      if (root !== lastRoot) lastRunAt = Number.NEGATIVE_INFINITY

      // A window regaining focus is not a rare event: clicking into it, ⌘-Tab, a native dialog
      // closing, moving between two windows of the studio. "One at a time" alone would still
      // walk the project on every one of them — and the very case this feature is for, the user
      // arranging files in the Finder and coming back, is a burst of them.
      const at = clock()
      if (at - lastRunAt < MIN_INTERVAL_MS) return

      lastRoot = root
      lastRunAt = at
      const controller = new AbortController()
      running = controller
      publish({ running: true, done: 0, total: 0 })

      const onProgress = ({ done, total }: RescanProgress): void =>
        publish({ running: true, done, total })

      catalog
        .rescan(root, { signal: controller.signal, onProgress })
        .then(report, warn)
        .finally(() => {
          running = null
          // Stamped on the way OUT as well: a pass over a large project outlasts the interval,
          // and the focus event that follows it would otherwise start another straight away.
          lastRunAt = clock()
          publish(IDLE_RESCAN)
        })
    },
  }
}
