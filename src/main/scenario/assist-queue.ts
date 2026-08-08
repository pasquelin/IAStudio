import { createRetry, type Retry } from './retry'

export type AssistQueueDeps = {
  concurrency: () => number
  maxRetries: () => number
  sleep: (ms: number) => Promise<void>
  backoffBaseMs?: number
}

export type AssistQueue = {
  /**
   * Queues a task and answers what it answered. A rejection is the caller's to handle: the
   * queue only decides when work runs, never what a failure means.
   */
  run: <T>(task: () => Promise<T>) => Promise<T>
  /** Abandons everything still waiting. Work already started is left to finish. */
  clear: () => void
  /** How many tasks are waiting or running — what tells a caller the queue is idle. */
  size: () => number
}

/** Thrown into a waiting task's caller when the queue is cleared out from under it. */
export class QueueClearedError extends Error {
  constructor() {
    super('queue-cleared')
    this.name = 'QueueClearedError'
  }
}

type Waiting = {
  start: () => void
  abandon: () => void
}

/**
 * Bounds the background assistance the studio asks for on its own.
 *
 * Fetching three hundred assets from the library would otherwise describe three hundred of them
 * at once — the burst CLAUDE.md lists as a known trap, and one the `JobManager` cannot bound
 * because none of this produces an asset or has a status to poll.
 *
 * Concurrency is read per dispatch rather than captured: it comes from the preferences, and a
 * queue drained over minutes must follow a user who lowers it mid-flight.
 */
export function createAssistQueue({
  concurrency,
  maxRetries,
  sleep,
  backoffBaseMs,
}: AssistQueueDeps): AssistQueue {
  const waiting: Waiting[] = []
  const retry: Retry = createRetry({
    maxRetries,
    sleep,
    ...(backoffBaseMs ? { backoffBaseMs } : {}),
  })
  let running = 0

  const pump = (): void => {
    while (running < concurrency()) {
      const next = waiting.shift()
      if (!next) return

      running++
      next.start()
    }
  }

  return {
    run: <T>(task: () => Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        // The slot is given back BEFORE the caller is answered: settling first would let a
        // caller resume — and read the queue — while its own task still counted as running.
        const release = (): void => {
          running--
          pump()
        }

        waiting.push({
          start: () => {
            void retry(task).then(
              value => {
                release()
                resolve(value)
              },
              (error: unknown) => {
                release()
                reject(error)
              },
            )
          },
          abandon: () => reject(new QueueClearedError()),
        })

        pump()
      }),

    clear: () => {
      for (const task of waiting.splice(0)) task.abandon()
    },

    size: () => waiting.length + running,
  }
}
