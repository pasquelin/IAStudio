import type { PeaksJob, PeaksMessage, PeaksResponse } from './peaksProtocol'

/**
 * The worker process, reduced to what the client needs. Injected rather than imported so the
 * protocol can be tested without forking anything — `utilityProcess` needs a live app.
 */
export type PeaksPort = {
  postMessage: (message: PeaksMessage) => void
  onMessage: (listener: (response: PeaksResponse) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
}

export type PeaksRun = PeaksJob & { signal?: AbortSignal }

/** Reduces PCM to a waveform, off this process entirely. */
export type PeaksClient = {
  compute: (run: PeaksRun) => Promise<Float32Array>
}

type Pending = {
  resolve: (peaks: Float32Array) => void
  reject: (error: Error) => void
  /** Drops the abort listener: a signal outlives the run it was handed to. */
  release: () => void
}

export function createPeaksClient(port: PeaksPort): PeaksClient {
  const pending = new Map<number, Pending>()
  let nextId = 1
  // A dead process swallows `postMessage` without a word, so a run posted into one would hold
  // its slot in the ingest pool for good. Same guard `catalogClient` carries, same reason.
  let closed = false

  port.onMessage(response => {
    const slot = pending.get(response.id)
    if (!slot) return
    pending.delete(response.id)
    slot.release()

    if (response.ok) slot.resolve(response.peaks)
    else slot.reject(new Error(response.error))
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
    compute: ({ signal, ...job }) =>
      new Promise((resolve, reject) => {
        if (closed) {
          reject(new Error('the waveform process is gone'))
          return
        }
        if (signal?.aborted) {
          reject(new Error('waveform cancelled before it started'))
          return
        }

        const id = nextId++

        // Sent first, the order `catalogClient` settled on: a throw here leaves nothing behind
        // and rejects this promise on its own. Safe because an answer is always a turn later.
        port.postMessage({ id, ...job })

        // Cancelling tells the worker to kill ffmpeg; the promise settles on its answer, so a
        // cancelled run frees its slot in the ingest pool like any other.
        const cancel = (): void => port.postMessage({ id, cancel: true })
        signal?.addEventListener('abort', cancel, { once: true })

        pending.set(id, {
          resolve,
          reject,
          release: () => signal?.removeEventListener('abort', cancel),
        })
      }),
  }
}
