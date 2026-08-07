import type { PeaksMessage, PeaksResponse } from './peaks-protocol'

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

export type PeaksRun = {
  binary: string
  args: string[]
  buckets: number
  samplesPerBucket: number
  signal?: AbortSignal
}

/** Reduces PCM to a waveform, off this process entirely. */
export type PeaksClient = {
  compute: (run: PeaksRun) => Promise<Float32Array>
}

export function createPeaksClient(port: PeaksPort): PeaksClient {
  const pending = new Map<
    number,
    { resolve: (peaks: Float32Array) => void; reject: (error: Error) => void }
  >()
  let nextId = 1

  port.onMessage(response => {
    const slot = pending.get(response.id)
    if (!slot) return
    pending.delete(response.id)

    if (response.ok) slot.resolve(response.peaks)
    else slot.reject(new Error(response.error))
  })

  port.onFailure(error => {
    const waiting = [...pending.values()]
    pending.clear()
    for (const slot of waiting) slot.reject(error)
  })

  return {
    compute: ({ binary, args, buckets, samplesPerBucket, signal }) =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('waveform cancelled before it started'))
          return
        }

        const id = nextId++
        pending.set(id, { resolve, reject })
        // Cancelling tells the worker to kill ffmpeg; the promise settles on its answer, so a
        // cancelled run frees its slot in the ingest pool like any other.
        signal?.addEventListener('abort', () => port.postMessage({ id, cancel: true }), {
          once: true,
        })
        port.postMessage({ id, binary, args, buckets, samplesPerBucket })
      }),
  }
}
