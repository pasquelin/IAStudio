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
  const waiting: (() => void)[] = []
  const retry: Retry = createRetry({
    maxRetries,
    sleep,
    ...(backoffBaseMs ? { backoffBaseMs } : {}),
  })
  let running = 0

  const pump = (): void => {
    while (running < concurrency()) {
      const start = waiting.shift()
      if (!start) return

      running++
      start()
    }
  }

  return {
    run: <T>(task: () => Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        // The slot is given back BEFORE the caller is answered: settling first would let a
        // caller resume — and queue more work — while its own task still counted as running.
        const release = (): void => {
          running--
          pump()
        }

        waiting.push(() => {
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
        })

        pump()
      }),
  }
}
