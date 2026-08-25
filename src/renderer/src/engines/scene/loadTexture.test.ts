import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTexture } from './textureCache'

/**
 * Which way up a decoded picture arrives.
 *
 * `texture.flipY` cannot answer for it: `WebGLTextures` skips `UNPACK_FLIP_Y_WEBGL` entirely when
 * the source is an `ImageBitmap`, so the `true` a `Texture` carries by default is granted by
 * nobody. The orientation has to be asked for at the DECODE, and that is what this reads —
 * jsdom has no `createImageBitmap`, so the call itself is the only witness available.
 */

/** The eight bytes that open every PNG, which is what `decoderFor` routes on. */
const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function servePicture(): { calls: ImageBitmapOptions[] } {
  const calls: ImageBitmapOptions[] = []

  vi.stubGlobal('fetch', async () => new Response(PNG_HEAD, { status: 200 }))
  vi.stubGlobal('createImageBitmap', async (_blob: Blob, options?: ImageBitmapOptions) => {
    calls.push(options ?? {})
    return { width: 2, height: 1, close: () => {} }
  })

  return { calls }
}

afterEach(() => vi.unstubAllGlobals())

describe('loadTexture', () => {
  it('asks the decoder to flip, which is what GL expects and what three cannot do here', async () => {
    const served = servePicture()

    await loadTexture('picture.png')

    expect(served.calls).toEqual([{ imageOrientation: 'flipY' }])
  })
})
