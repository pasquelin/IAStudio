import RgbeWorker from './rgbe.worker?worker'
import { isRgbeFailure, type RgbeRequest, type RgbeResponse } from './rgbeMessage'

/**
 * Radiance bytes from a half-float readback. A port for the same reason the texture's is: jsdom
 * has no `Worker`, and what a caller needs to know is the shape of the answer, not the wiring.
 */
export type RgbeEncoder = (half: Uint16Array, width: number, height: number) => Promise<Uint8Array>

/**
 * One worker per call, ended in a `finally`: an export is a rare, heavy gesture, and a worker
 * left alive between two of them is a thread holding a 32 MiB buffer nobody is reading.
 */
export const encodeRgbeOffThread: RgbeEncoder = (half, width, height) => {
  const worker = new RgbeWorker()

  return new Promise<Uint8Array>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<RgbeResponse>) => {
      if (isRgbeFailure(event.data)) reject(new Error(event.data.failure))
      else resolve(event.data.file)
    })
    // A worker that dies takes its promise with it: without this the export hangs for good, which
    // is the defect this branch already paid for on the bundle reader.
    worker.addEventListener('error', event => reject(new Error(event.message)))

    // Transferred, not copied: the readback is 64 MiB at 4K, and the window has no use for it
    // once it has been posted.
    worker.postMessage({ half, width, height } satisfies RgbeRequest, { transfer: [half.buffer] })
  }).finally(() => worker.terminate())
}
