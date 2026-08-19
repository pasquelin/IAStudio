import type { ExportWatch } from '@shared/domain/exportProgress'
import type { BundleJob, BundleMessage, BundleResponse } from './bundleProtocol'

/** The worker, reduced to what the client needs — injected, since `fork` needs a live app. */
export type BundlePort = {
  postMessage: (message: BundleMessage) => void
  onMessage: (listener: (response: BundleResponse) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
}

/** Packs a montage and its rushes into one archive, off this process entirely. */
export type BundleClient = {
  /** Answers whether the bundle was written — `false` when it was stopped. */
  write: (run: BundleJob & ExportWatch) => Promise<boolean>
}

type Pending = {
  resolve: (written: boolean) => void
  reject: (error: Error) => void
  onStep?: (done: number, total: number) => void
  /** Drops the abort listener: a signal outlives the run it was handed to. */
  release: () => void
}

export function createBundleClient(port: BundlePort): BundleClient {
  const pending = new Map<number, Pending>()
  let nextId = 1
  // A dead process swallows `postMessage` without a word, so a bundle posted into one would leave
  // a row turning in the status line for the rest of the session. Same guard `peaksClient` has.
  let closed = false

  port.onMessage(response => {
    const slot = pending.get(response.id)
    if (!slot) return

    if (response.kind === 'progress') {
      slot.onStep?.(response.done, response.total)
      return
    }

    pending.delete(response.id)
    slot.release()

    if (response.kind === 'settled') slot.resolve(response.written)
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
    write: ({ onStep, signal, ...job }) =>
      new Promise((resolve, reject) => {
        if (closed) {
          reject(new Error('the bundle process is gone'))
          return
        }
        if (signal?.aborted) {
          resolve(false)
          return
        }

        const id = nextId++

        // Sent first, the order `peaksClient` settled on: a throw here leaves nothing behind and
        // rejects this promise on its own. Safe because an answer is always a turn later.
        port.postMessage({ id, ...job })

        // The worker answers the cancel like any other end, so the half-written file is removed
        // there rather than being left for this side to guess at.
        const cancel = (): void => port.postMessage({ id, cancel: true })
        signal?.addEventListener('abort', cancel, { once: true })

        pending.set(id, {
          resolve,
          reject,
          onStep,
          release: () => signal?.removeEventListener('abort', cancel),
        })
      }),
  }
}
