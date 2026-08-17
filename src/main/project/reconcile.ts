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
}

export type Reconciler = {
  /**
   * Asks for a pass. Answers whether one was started — a pass already running is not queued
   * behind itself, and nothing is asked of a window that closed the project meanwhile.
   */
  request: () => boolean
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
}: ReconcilerDeps): Reconciler {
  let running: AbortController | null = null
  let state: RescanState = IDLE_RESCAN

  const publish = (next: RescanState): void => {
    state = next
    announce(next)
  }

  return {
    state: () => state,

    stop: () => running?.abort(),

    request: () => {
      if (running) return false

      const root = rootOf()
      const catalog = catalogOf()
      if (!root || !catalog) return false

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
          publish(IDLE_RESCAN)
        })

      return true
    },
  }
}
