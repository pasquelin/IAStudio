/**
 * The half every worker-process client shares: numbering the runs, holding the ones in flight,
 * carrying a stop to the worker, and rejecting the lot when the process dies.
 *
 * Written once because it had been spelt three times — the third copy quoting the second in its
 * own comments. What differs between them is the SHAPE of a response and what a stop means, and
 * both of those are asked for here rather than reimplemented around a copy.
 */

/** The worker, reduced to what a client needs — injected, since forking needs a live app. */
type ProcessPort<Message, Response> = {
  postMessage: (message: Message) => void
  onMessage: (listener: (response: Response) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
}

/** What one response means. A worker says one of exactly these three things about a run. */
type ProcessReading<Result> =
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'settled'; result: Result }
  | { kind: 'failed'; error: string }

type ProcessWatch = {
  onStep?: (done: number, total: number) => void
  signal?: AbortSignal
}

export type ProcessClientOptions<Message, Response, Result> = {
  port: ProcessPort<Message, Response>
  /** Which run a response belongs to. */
  runOf: (response: Response) => number
  read: (response: Response) => ProcessReading<Result>
  /** What a call rejects with once the process is gone. */
  gone: string
  /** What tells the worker to drop a run it has already been given. */
  cancel: (id: number) => Message
  /**
   * What a stop that arrived BEFORE the job did answers. Absent rejects instead — which of the
   * two is right belongs to the caller: a bundle that never started is `false`, not a failure.
   */
  stopped?: () => Result
}

export type ProcessClient<Message, Result> = {
  /** Posts a job under a fresh id and waits for the worker to settle it. */
  send: (job: (id: number) => Message, watch?: ProcessWatch) => Promise<Result>
}

type Pending<Result> = {
  resolve: (result: Result) => void
  reject: (error: Error) => void
  onStep?: (done: number, total: number) => void
  /** Drops the abort listener: a signal outlives the run it was handed to. */
  release: () => void
}

export function createProcessClient<Message, Response, Result>({
  port,
  runOf,
  read,
  gone,
  cancel,
  stopped,
}: ProcessClientOptions<Message, Response, Result>): ProcessClient<Message, Result> {
  const pending = new Map<number, Pending<Result>>()
  let nextId = 1
  // A dead process swallows `postMessage` without a word, so a job posted into one would leave a
  // row turning for the rest of the session.
  let closed = false

  port.onMessage(response => {
    const slot = pending.get(runOf(response))
    if (!slot) return

    const reading = read(response)
    if (reading.kind === 'progress') {
      slot.onStep?.(reading.done, reading.total)
      return
    }

    pending.delete(runOf(response))
    slot.release()

    if (reading.kind === 'settled') slot.resolve(reading.result)
    else slot.reject(new Error(reading.error))
  })

  port.onFailure(error => {
    closed = true
    const waiting = [...pending.values()]
    pending.clear()
    for (const slot of waiting) {
      slot.release()
      slot.reject(error)
    }
  })

  return {
    send: (job, { onStep, signal } = {}) =>
      new Promise<Result>((resolve, reject) => {
        if (closed) {
          reject(new Error(gone))
          return
        }
        if (signal?.aborted) {
          if (stopped) resolve(stopped())
          else reject(new Error(gone))
          return
        }

        const id = nextId++

        // Sent FIRST: a throw here leaves nothing behind and rejects this promise on its own.
        // Safe because an answer is always a turn later.
        port.postMessage(job(id))

        // The worker answers a cancel like any other end, so whatever it half-wrote is cleaned
        // up there rather than left for this side to guess at.
        const drop = (): void => port.postMessage(cancel(id))
        signal?.addEventListener('abort', drop, { once: true })

        pending.set(id, {
          resolve,
          reject,
          onStep,
          release: () => signal?.removeEventListener('abort', drop),
        })
      }),
  }
}
