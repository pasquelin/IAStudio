/**
 * Which way up a decoded picture arrives.
 *
 * `texture.flipY` cannot answer for it: `WebGLTextures` skips `UNPACK_FLIP_Y_WEBGL` entirely when
 * the source is an `ImageBitmap`, so the `true` a `Texture` carries by default is granted by
 * nobody. The orientation has to be asked for at the DECODE, and that is what this reads —
 * jsdom has no `createImageBitmap`, so the call itself is the only witness available.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataTexture } from 'three'
import { loadTexture } from './textureCache'

/** The real one decodes nothing under jsdom; what is under test is the flag, not the pixels. */
vi.mock('three/addons/loaders/EXRLoader.js', () => ({
  EXRLoader: class {
    loadAsync() {
      const texture = new DataTexture()
      // What `DataTextureLoader` writes from `texData.flipY` — EXR's decoder already flipped.
      texture.flipY = false
      return Promise.resolve(texture)
    }
  },
}))

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

  // The way glTF stores its UVs — asked for by the maps of an imported model, and by nothing else.
  it('asks for the picture unflipped when that is the orientation wanted', async () => {
    const served = servePicture()

    await loadTexture('picture.png', 'from-image')

    expect(served.calls).toEqual([{ imageOrientation: 'from-image' }])
  })
})

/** `0x76 0x2f 0x31 0x01`, the four bytes an OpenEXR opens on — what `decoderFor` routes it by. */
const OPENEXR_HEAD = new Uint8Array([0x76, 0x2f, 0x31, 0x01])

/**
 * A float picture is a `DataTexture`, so `flipY` DOES reach it — and each loader answers the value
 * its own decoder needs: `HDRLoader` writes its scanlines bottom-up and asks for `true`, `EXRLoader`
 * has already turned them over and asks for `false`. Written flat rather than turned over, the
 * studio's own convention mirrored every `.exr` sky, and nothing on this path said so.
 */
describe('loadTexture, on a float picture', () => {
  const serveFloat = (): void => {
    vi.stubGlobal('fetch', async () => new Response(OPENEXR_HEAD, { status: 200 }))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:exr', revokeObjectURL: () => {} })
  }

  it('leaves the decoder the flip it asked for', async () => {
    serveFloat()

    expect((await loadTexture('sky.exr')).flipY).toBe(false)
  })

  it('turns that flip over rather than setting it, for the unflipped orientation', async () => {
    serveFloat()

    expect((await loadTexture('sky.exr', 'from-image')).flipY).toBe(true)
  })
})
