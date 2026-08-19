/// <reference lib="webworker" />
/**
 * Radiance encoding, off the window's thread. Wiring only, like `audio.worker.ts`: the format
 * lives in `shared/domain/rgbe.ts`, which needs no worker to be measured.
 *
 * Here because it is 8.4 M iterations at 4K and 33.5 M at 8K — 265 ms and over a second of a
 * thread that has an interface to keep drawing. Invariant 6.
 */
import { messageOf } from '@shared/guards'
import { encodeRgbe } from '@shared/domain/rgbe'
import type { RgbeRequest, RgbeResponse } from './rgbeMessage'

declare const self: DedicatedWorkerGlobalScope

self.addEventListener('message', (event: MessageEvent<RgbeRequest>) => {
  const { half, width, height } = event.data

  try {
    const file = encodeRgbe(half, width, height)
    // Transferred back rather than copied: a 4K panorama is 32 MiB, and structured clone would
    // make a second one on the window's side of the wire.
    self.postMessage({ file } satisfies RgbeResponse, { transfer: [file.buffer] })
  } catch (error) {
    self.postMessage({ failure: messageOf(error) } satisfies RgbeResponse)
  }
})
