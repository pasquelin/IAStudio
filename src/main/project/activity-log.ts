import type { ActivityDraft, ActivityEntry, ActivityQuery } from '@shared/domain/activity'
import { log } from '../log'
import type { AsyncCatalog } from './catalog-client'

/**
 * How long lines are gathered before they are written and the windows hear about them.
 *
 * Here rather than in the domain: it says how this writer batches, and no window can or should
 * depend on it. Short enough that a failure still feels immediate.
 */
export const ACTIVITY_FLUSH_MS = 200

/** What a caller says happened. The time is stamped here, so no caller has to remember to. */
export type ActivityReport = Omit<ActivityDraft, 'at'>

export type ActivityLogDeps = {
  /**
   * The catalogue of the project that is open, or null when none is. Read per flush rather than
   * held: a project can be closed and another opened while lines are still in the queue.
   */
  catalog: () => AsyncCatalog | null
  broadcast: (entries: readonly ActivityEntry[]) => void
  now: () => string
}

export type ActivityLog = {
  /**
   * Records a line. Returns immediately: this is called from failure paths, and a journal that
   * made its callers await would put the disk on the critical path of every error.
   */
  record: (report: ActivityReport) => void
  read: (query: ActivityQuery) => Promise<ActivityEntry[]>
  /** Writes what is queued right now. The shutdown path and the tests both need this. */
  flush: () => Promise<void>
  dispose: () => void
}

/**
 * The studio's account of itself: what it did, and what it failed to do.
 *
 * Lines are gathered before they are written. Pushing two hundred assets records two hundred
 * lines, and one transaction and one IPC message each would spend the boundary and the disk on
 * bookkeeping — the same reason the ingest bar coalesces its progress.
 *
 * A line survives the project it belongs to being closed: it is broadcast either way, so the
 * toast still appears, and only its persistence depends on there being a catalogue.
 */
export function createActivityLog(deps: ActivityLogDeps): ActivityLog {
  const queue: ActivityDraft[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  /** A write already on its way. `flush` has to wait for it, not merely for what is queued. */
  let inFlight: Promise<void> | null = null
  let disposed = false

  // Ids for lines no catalogue took. SQLite counts up from 1, so counting down from 0 can never
  // collide with a real one — and the windows need distinct ids to tell two lines apart.
  let unsaved = 0

  const write = async (): Promise<void> => {
    const batch = queue.splice(0)
    if (batch.length === 0) return

    const catalog = deps.catalog()
    if (!catalog) {
      // No project open, so nowhere to keep it. Still said out loud: a failure the user can see
      // is the whole point, and the terminal keeps what the database cannot.
      deps.broadcast(batch.map(entry => ({ ...entry, id: --unsaved })))
      return
    }

    try {
      deps.broadcast(await catalog.appendActivity(batch))
    } catch (error) {
      // The journal failing has nowhere left to be journalled — saying so twice would loop.
      log.error('activity', `could not write ${batch.length} entries: ${String(error)}`)
    }
  }

  const start = (): Promise<void> => {
    const running = write().finally(() => {
      if (inFlight === running) inFlight = null
    })
    inFlight = running
    return running
  }

  const schedule = (): void => {
    if (timer !== null || disposed) return

    // `write` empties the queue synchronously on entry, so two of them never take the same
    // lines, and the catalogue thread answers in the order it was asked — nothing to serialise.
    timer = setTimeout(() => {
      timer = null
      void start()
    }, ACTIVITY_FLUSH_MS)

    // Node keeps the process alive for a pending timer; a journal must never be the reason the
    // app refuses to quit.
    timer.unref?.()
  }

  return {
    record: report => {
      if (disposed) return

      queue.push({ ...report, at: deps.now() })
      schedule()
    },

    read: async query => (await deps.catalog()?.readActivity(query)) ?? [],

    flush: async () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }

      // The one already on its way first: the catalogue is about to stop answering, and closing
      // it rejects everything still pending — including a batch this would otherwise not wait for.
      await inFlight
      await start()
    },

    dispose: () => {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      queue.length = 0
    },
  }
}
