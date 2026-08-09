import { NoColorSpace, SRGBColorSpace, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { fakeTextureSource } from '../../viewport/viewport-fixtures'
import { createDerivePort } from './derive-port'

/** Everything a GPU is needed for is below this line; everything above it is testable in jsdom. */
describe('the derivation port', () => {
  it('reads the source as stored, whatever colour space it arrived in', async () => {
    const source = new Texture()
    source.colorSpace = SRGBColorSpace
    const port = createDerivePort({ loadTexture: () => Promise.resolve(source) })

    // It goes no further in jsdom — there is no WebGL — and that is enough to see the decision.
    await expect(port({ channel: 'normal', sourceUrl: 'asset://a' })).rejects.toThrow()

    expect(source.colorSpace).toBe(NoColorSpace)
  })

  /** The frame is the source's own size, so nothing reads a mip and building one is 22 MB wasted. */
  it('leaves the mip pyramid unbuilt', async () => {
    const source = new Texture()
    const port = createDerivePort({ loadTexture: () => Promise.resolve(source) })

    await expect(port({ channel: 'normal', sourceUrl: 'asset://a' })).rejects.toThrow()

    expect(source.generateMipmaps).toBe(false)
  })

  /**
   * A texture whose image never decoded has no size, and a zero divides into an infinite texel
   * step. Refused before a context is opened, so a bad source costs nothing.
   */
  it('refuses a source that decoded to nothing, before opening a context', async () => {
    const { load } = fakeTextureSource()
    const port = createDerivePort({ loadTexture: load })

    await expect(port({ channel: 'normal', sourceUrl: 'asset://a' })).rejects.toThrow(
      /decoded to nothing/,
    )
  })

  it('refuses a source whose picture claims no pixels', async () => {
    const source = new Texture()
    source.image = { width: 0, height: 512 }
    const port = createDerivePort({ loadTexture: () => Promise.resolve(source) })

    await expect(port({ channel: 'normal', sourceUrl: 'asset://a' })).rejects.toThrow(
      /decoded to nothing/,
    )
  })

  it('asks the loader for the picture it was pointed at', async () => {
    const { load } = fakeTextureSource()
    const port = createDerivePort({ loadTexture: load })

    await expect(port({ channel: 'normal', sourceUrl: 'asset://brick' })).rejects.toThrow()

    expect(load).toHaveBeenCalledWith('asset://brick')
  })
})
