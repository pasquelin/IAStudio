/**
 * One worker, the requests out on it, and what happens when it dies.
 *
 * NOT `workerSession`, and not mergeable into it: this shape posts BEFORE it records, answers a
 * request many times, and RESOLVES `null` where that one rejects — three opposites, not gaps.
 */

export type PortSlot<T> = {
  resolve: (value: T | null) => void
  reject: (error: Error) => void
  onProgress?: (progress: number) => void
}

/** Many progress reports, then exactly one `done`. A wire union must spell all three arms. */
export type PortResponse =
  | { id: number; done: false; progress: number }
  | { id: number; done: true; ok: true }
  | { id: number; done: true; ok: false; error: string }

type Answered<R> = Extract<R, { done: true; ok: true }>

export type WorkerPort<T> = {
  /** Numbering is the port's, so no caller can hand out one of its own. */
  claim: () => number
  /** Started at the first request, replaced after one dies. */
  running: () => Worker
  /** Let go: a request arriving after that answers `null`. */
  isGone: () => boolean
  /** Recorded AFTER the post, so a payload the clone cannot carry leaves no slot behind. */
  record: (id: number, slot: PortSlot<T>) => void
  /** `false` when the request was already answered for — what tells a late abort from a live one. */
  forget: (id: number) => boolean
  dispose: () => void
}

/** @param what names the worker in the two failures no `try` inside it can catch. */
export function createWorkerPort<T, R extends PortResponse>(
  spawn: () => Worker,
  what: string,
  valueOf: (answer: Answered<R>) => T,
): WorkerPort<T> {
  const waiting = new Map<number, PortSlot<T>>()
  let worker: Worker | null = null
  let gone = false
  let nextId = 0

  const settle = (response: R): void => {
    const slot = waiting.get(response.id)
    if (!slot) return

    if (!response.done) {
      slot.onProgress?.(response.progress)
      return
    }

    waiting.delete(response.id)
    // TypeScript does not narrow a generic by its discriminant, and `done && ok` just held.
    if (response.ok) slot.resolve(valueOf(response as Answered<R>))
    else slot.reject(new Error(response.error))
  }

  const abandon = (dead: Worker, reason: string): void => {
    // A late event from a worker already replaced must not take its successor down with it.
    if (worker !== dead) return

    worker.terminate()
    worker = null
    for (const slot of waiting.values()) slot.reject(new Error(reason))
    waiting.clear()
  }

  return {
    claim: () => (nextId += 1),

    running: () => {
      if (worker) return worker

      const started = spawn()
      started.addEventListener('message', (event: MessageEvent<R>) => settle(event.data))
      started.addEventListener('error', event =>
        abandon(started, `${what} worker failed: ${event.message}`),
      )
      started.addEventListener('messageerror', () =>
        abandon(started, `${what} worker sent an unreadable answer`),
      )
      worker = started
      return started
    },

    isGone: () => gone,

    record: (id, slot) => void waiting.set(id, slot),

    forget: id => waiting.delete(id),

    dispose: () => {
      gone = true
      worker?.terminate()
      worker = null
      // Resolved, not rejected: a window closing is nobody's failure.
      for (const slot of waiting.values()) slot.resolve(null)
      waiting.clear()
    },
  }
}
