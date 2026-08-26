import { Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { newMaterial, type MaterialState } from '../materialState'
import { exportChannelsOf } from './channels'
import { createMaterialExportPort } from './exportPort'

/**
 * Everything below the pass needs a GPU, and jsdom has none: a run reaches `createPackPass` and
 * then throws. What is readable from here is what the port decides before that — which pictures,
 * read at which size — and it is the part a target's own ceiling lives in.
 */

const decoded = (width: number, height: number): Texture => {
  const texture = new Texture()
  texture.image = { width, height }
  return texture
}

const channel = (
  assetId: string,
): { assetId: string; origin: 'imported'; width: number; height: number } => ({
  assetId,
  origin: 'imported',
  width: 0,
  height: 0,
})

function textureWith(changes: Partial<MaterialState> = {}): MaterialState {
  return { ...newMaterial(), ...changes }
}

describe('the texture export port', () => {
  const state = textureWith({
    channels: {
      baseColor: channel('a-base'),
      roughness: channel('a-rough'),
      metalness: channel('a-metal'),
      ao: channel('a-ao'),
    },
  })

  it('asks for nothing at all when the texture has no channel', async () => {
    const loadTexture = vi.fn(() => Promise.resolve(decoded(8, 8)))
    const port = createMaterialExportPort({ loadTexture })

    const files = await port({
      target: 'raw',
      channels: {},
      name: 'mat',
      material: state.material,
      shape: 'sphere',
    })

    expect(files).toEqual([])
    expect(loadTexture).not.toHaveBeenCalled()
  })

  /**
   * The one target that would otherwise have gone on: it writes a single file rather than a
   * folder, so an empty texture used to open a dialog and answer a grey sphere wearing nothing.
   */
  it('asks for nothing for glTF either, which writes one file rather than a folder', async () => {
    const loadTexture = vi.fn(() => Promise.resolve(decoded(8, 8)))
    const port = createMaterialExportPort({ loadTexture })

    const files = await port({
      target: 'gltf',
      channels: {},
      name: 'mat',
      material: state.material,
      shape: 'sphere',
    })

    expect(files).toEqual([])
    expect(loadTexture).not.toHaveBeenCalled()
  })

  it('decodes every channel a picture reads, at the url of its asset', async () => {
    const asked: string[] = []
    const loadTexture = vi.fn((url: string) => {
      asked.push(url)
      // Throws on the second, so only the first picture's loads are observed — the pass below
      // needs a GPU and would have stopped the run there anyway.
      return Promise.resolve(decoded(8, 8))
    })

    await expect(
      createMaterialExportPort({ loadTexture })({
        target: 'unreal',
        channels: exportChannelsOf(state),
        name: 'mat',
        material: state.material,
        shape: 'sphere',
      }),
    ).rejects.toThrow()

    // The base colour first: it is the first picture of the Unreal recipe.
    expect(asked[0]).toContain('a-base')
  })
})

describe('the size an exported picture is drawn at', () => {
  const state = textureWith({
    channels: {
      ao: channel('a-ao'),
      roughness: channel('a-rough'),
      metalness: channel('a-metal'),
    },
  })

  /** The pass is built on the sources; the frame it draws into is what the port decides. */
  async function frameFor(target: 'unreal' | 'roblox', sizes: Map<string, [number, number]>) {
    const seen: { width: number; height: number }[] = []
    const loadTexture = (url: string): Promise<Texture> => {
      const found = [...sizes].find(([asset]) => url.includes(asset))?.[1] ?? [8, 8]
      const texture = decoded(found[0], found[1])
      seen.push({ width: found[0], height: found[1] })
      return Promise.resolve(texture)
    }

    await expect(
      createMaterialExportPort({ loadTexture })({
        target,
        channels: exportChannelsOf(state),
        name: 'mat',
        material: state.material,
        shape: 'sphere',
      }),
    ).rejects.toThrow()

    return seen
  }

  it('reads every source of a packed picture, whatever their sizes', async () => {
    const seen = await frameFor(
      'unreal',
      new Map([
        ['a-ao', [512, 256]],
        ['a-rough', [2048, 1024]],
        ['a-metal', [64, 32]],
      ]),
    )

    // Three sources for one ORM, none of them square: a square would pass with the axes swapped.
    expect(seen).toEqual([
      { width: 512, height: 256 },
      { width: 2048, height: 1024 },
      { width: 64, height: 32 },
    ])
  })

  /**
   * Baking five channels at full resolution is seconds of GPU, so the stop is checked between
   * pictures — which is where this reads it: the first turn of the loop comes before any pass.
   */
  it('bakes no picture at all when the export was already stopped', async () => {
    const loadTexture = vi.fn(() => Promise.resolve(decoded(8, 8)))

    await expect(
      createMaterialExportPort({ loadTexture })(
        {
          target: 'unreal',
          channels: exportChannelsOf(state),
          name: 'mat',
          material: state.material,
          shape: 'sphere',
        },
        { signal: AbortSignal.abort() },
      ),
    ).rejects.toThrow()

    expect(loadTexture).not.toHaveBeenCalled()
  })
})
