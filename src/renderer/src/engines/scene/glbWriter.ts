/**
 * The port onto the glb-writing worker: a character's own file, with its skeleton put into it.
 *
 * `skinWeights`'s shape, over the same `workerPort`. What is its own is the refusal: a file this
 * pass cannot patch comes back NAMED, because a `.glb` is linked by index and half a pass over
 * one gives a broken file rather than a half-right one.
 */
import { createWorkerPort } from '../core/workerPort'
import { writeBuffers, type GlbWriteRequest, type GlbWriteResponse } from './glbWriteMessage'
import type { GlbSkinPatch } from './glbSkin'

export type GlbWriter = {
  /** `null` means the request was taken back, or the port let go while it was out. */
  write: (
    file: Uint8Array,
    patch: GlbSkinPatch,
    watch?: { signal?: AbortSignal },
  ) => Promise<Uint8Array | null>
  dispose: () => void
}

export function createGlbWriter(spawn: () => Worker): GlbWriter {
  const port = createWorkerPort<Uint8Array, GlbWriteResponse>(spawn, 'glb-write', answer =>
    answer.ok ? answer.file : new Uint8Array(),
  )

  return {
    write: (file, patch, watch) =>
      new Promise<Uint8Array | null>((resolve, reject) => {
        if (port.isGone()) {
          resolve(null)
          return
        }

        const id = port.claim()
        const running = port.running()
        const request: GlbWriteRequest = { id, file, ...patch, skins: [...patch.skins] }

        // Posted before it is recorded, for `skinWeights`'s reason: a payload the structured
        // clone cannot carry throws with no slot left behind.
        running.postMessage(request, writeBuffers(request))

        const give = (): void => {
          if (!port.forget(id)) return
          watch?.signal?.removeEventListener('abort', give)
          running.postMessage({ id, cancel: true })
          resolve(null)
        }

        const settled =
          <T>(hand: (value: T) => void) =>
          (value: T): void => {
            watch?.signal?.removeEventListener('abort', give)
            hand(value)
          }

        port.record(id, { resolve: settled(resolve), reject: settled(reject) })

        if (watch?.signal?.aborted) {
          give()
          return
        }

        watch?.signal?.addEventListener('abort', give)
      }),

    dispose: port.dispose,
  }
}
