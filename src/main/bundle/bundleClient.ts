import type { ExportWatch } from '@shared/domain/exportProgress'
import type {
  BundleJob,
  BundleMessage,
  BundleReadJob,
  BundleResponse,
  BundleWriteJob,
} from './bundleProtocol'
import type { OtiozRead } from './otiozRead'

/** The worker, reduced to what the client needs — injected, since `fork` needs a live app. */
export type BundlePort = {
  postMessage: (message: BundleMessage) => void
  onMessage: (listener: (response: BundleResponse) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
}

/** Packs a montage and its rushes into one archive, and unpacks one, off this process entirely. */
export type BundleClient = {
  /** Answers whether the bundle was written — `false` when it was stopped. */
  write: (run: Omit<BundleWriteJob, 'writes'> & ExportWatch) => Promise<boolean>
  /** Answers the cut and where each medium landed — `null` when it was stopped. */
  read: (run: Omit<BundleReadJob, 'writes'> & ExportWatch) => Promise<OtiozRead | null>
}

type Settled = boolean | OtiozRead | null

type Pending = {
  resolve: (settled: Settled) => void
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

    if (response.kind === 'wrote') slot.resolve(response.written)
    else if (response.kind === 'read') slot.resolve(response.contents)
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

  /** One promise for both directions: what differs is the job posted and the answer read back. */
  const run = (job: BundleJob, { onStep, signal }: ExportWatch): Promise<Settled> =>
    new Promise((resolve, reject) => {
      if (closed) {
        reject(new Error('the bundle process is gone'))
        return
      }
      if (signal?.aborted) {
        resolve(job.writes ? false : null)
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
    })

  return {
    // The two casts are the boundary itself: the worker answers `wrote` to a write and `read` to
    // a read, and nothing in the type system carries that pairing across a `postMessage`.
    write: ({ onStep, signal, ...job }) =>
      run({ writes: true, ...job }, { onStep, signal }) as Promise<boolean>,
    read: ({ onStep, signal, ...job }) =>
      run({ writes: false, ...job }, { onStep, signal }) as Promise<OtiozRead | null>,
  }
}
