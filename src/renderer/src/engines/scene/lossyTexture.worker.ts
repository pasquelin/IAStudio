/// <reference lib="webworker" />
import type { LossyTextureRequest, LossyTextureResponse } from './lossyTextureMessage'

declare const self: DedicatedWorkerGlobalScope

self.addEventListener('message', (event: MessageEvent<LossyTextureRequest>) => {
  void optimize(event.data)
})

async function optimize(request: LossyTextureRequest): Promise<void> {
  try {
    self.postMessage({ id: request.id, done: false, progress: 0.1 } satisfies LossyTextureResponse)
    const source = new ArrayBuffer(request.bytes.byteLength)
    new Uint8Array(source).set(request.bytes)
    const bitmap = await createImageBitmap(new Blob([source]))
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * request.scale)),
      Math.max(1, Math.round(bitmap.height * request.scale)),
    )
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      self.postMessage({ id: request.id, done: true, ok: true } satisfies LossyTextureResponse)
      return
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const extension = request.quality === undefined ? 'png' : 'jpg'
    const blob = await canvas.convertToBlob({
      type: extension === 'png' ? 'image/png' : 'image/jpeg',
      ...(request.quality === undefined ? {} : { quality: request.quality }),
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    self.postMessage(
      {
        id: request.id,
        done: true,
        ok: true,
        override: { id: request.assetId, bytes, extension },
      } satisfies LossyTextureResponse,
      [bytes.buffer],
    )
  } catch {
    // Containers unsupported by Chromium remain byte-identical instead of aborting the package.
    self.postMessage({ id: request.id, done: true, ok: true } satisfies LossyTextureResponse)
  }
}
