import { flipToSrgbInto } from './film'
import type { FilmEncodeRequest, FilmEncodeResponse } from './filmEncodeMessage'

self.onmessage = (event: MessageEvent<FilmEncodeRequest>): void => {
  const { id, pixels, width, height } = event.data
  const fail = (failure: string): void => {
    self.postMessage({ id, failure } satisfies FilmEncodeResponse)
  }

  try {
    const surface = new OffscreenCanvas(width, height)
    const context = surface.getContext('2d')
    if (!context) {
      fail('no 2d context')
      return
    }

    const image = context.createImageData(width, height)
    flipToSrgbInto(image.data, pixels, width, height)
    context.putImageData(image, 0, 0)
    void surface
      .convertToBlob({ type: 'image/png' })
      .then(async blob => {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        self.postMessage({ id, bytes } satisfies FilmEncodeResponse, { transfer: [bytes.buffer] })
      })
      .catch((error: unknown) => {
        fail(error instanceof Error ? error.message : String(error))
      })
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}
