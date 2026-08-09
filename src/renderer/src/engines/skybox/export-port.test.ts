import { NoColorSpace, SRGBColorSpace, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { createSkyboxExportPort } from './export-port'

/**
 * Everything below the pass needs a GPU, and jsdom has none: a run reaches the renderer and then
 * throws. What is readable from here is what the port decides before that — which picture it
 * asks for, how many times, and how it decides to read it.
 */

const decoded = (width: number, height: number): Texture => {
  const texture = new Texture()
  texture.image = { width, height }
  // What `loadSource` leaves on every picture it hands over: right for a PBR channel, and the
  // thing this port has to undo.
  texture.colorSpace = NoColorSpace
  return texture
}

const request = { assetId: 'a-sky', adjustments: NEUTRAL_ADJUSTMENTS, name: 'Ciel', size: 1024 }

describe('the skybox export port', () => {
  it('asks for the source by its asset url, and for nothing else', async () => {
    const loadTexture = vi.fn((_url: string) => Promise.resolve(decoded(4096, 2048)))
    const port = createSkyboxExportPort({ loadTexture })

    await expect(port(request)).rejects.toThrow()

    expect(loadTexture).toHaveBeenCalledTimes(1)
    expect(loadTexture.mock.calls[0]?.[0]).toContain('a-sky')
  })

  it('decodes the sky as a colour, which is what the shared loader does not do', async () => {
    const texture = decoded(4096, 2048)
    const port = createSkyboxExportPort({ loadTexture: () => Promise.resolve(texture) })

    await expect(port(request)).rejects.toThrow()

    // Left as stored, the grading would work on sRGB numbers and the pass would encode them a
    // second time on the way out — a sky visibly washed out, with nothing to point at.
    expect(texture.colorSpace).toBe(SRGBColorSpace)
    // `needsUpdate` is write-only in three — it bumps `version`, and reading it back gives
    // nothing. The version is what tells the renderer to upload again under the new colour
    // space; set without it, the decode would stay the one the loader asked for.
    expect(texture.version).toBeGreaterThan(0)
  })

  it('decodes the panorama once for all six faces, never once per face', async () => {
    const loadTexture = vi.fn((_url: string) => Promise.resolve(decoded(2048, 1024)))
    const port = createSkyboxExportPort({ loadTexture })

    await expect(port(request)).rejects.toThrow()
    await expect(port({ ...request, size: 512 })).rejects.toThrow()

    // Once per export, not once per face: a 4K panorama is 32 MB decoded, and six of them at a
    // time is what a browser evicts a live viewport's context to make room for.
    expect(loadTexture).toHaveBeenCalledTimes(2)
  })
})
