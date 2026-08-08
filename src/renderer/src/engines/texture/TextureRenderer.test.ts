import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepeatWrapping } from 'three'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { fakeEnvironment, fakeTextureSource } from '../viewport/viewport-fixtures'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { TextureRenderer } from './TextureRenderer'
import { newTexture, slotFor, type ChannelMap, type TextureState } from './texture-state'

const MAP: Omit<ChannelMap, 'assetId'> = { origin: 'generated', width: 512, height: 512 }

const channelOf = (channel: PbrChannel, assetId: string): TextureState => {
  const state = newTexture()
  state.channels[channel] = { ...MAP, assetId }
  return state
}

/** All eight filled, which is what the loops in the engine actually have to handle. */
const everyChannel = (): TextureState => {
  const state = newTexture()
  for (const channel of PBR_CHANNELS) state.channels[channel] = { ...MAP, assetId: `${channel}-1` }
  return state
}

/**
 * `mount` builds a real `WebGLRenderer`, which jsdom cannot give (`test-setup` hands back no canvas
 * context). Stubbing the viewport's mount and its `gl` accessor is enough — nothing here
 * dereferences the renderer, so what the engine decides is reachable and what it draws is not.
 */
vi.mock('../viewport/environment', () => ({ createEnvironment: () => fakeEnvironment() }))

const skyOf = (assetId: string): TextureState => {
  const state = newTexture()
  state.preview.environment = { kind: 'skybox', assetId }
  return state
}

describe('the texture preview', () => {
  let source: ReturnType<typeof fakeTextureSource>
  let host: HTMLElement

  beforeEach(() => {
    source = fakeTextureSource()
    vi.spyOn(ViewportEngine.prototype, 'mount').mockImplementation(() => {})
    // `as`: `mount` only checks that a renderer exists before handing it to `createEnvironment`,
    // which is mocked above — so nothing ever reads a field of it.
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue({} as never)
    host = document.createElement('div')
  })

  const mounted = (): TextureRenderer => {
    const renderer = new TextureRenderer({ loadTexture: source.load })
    renderer.mount(host)
    return renderer
  }

  const applied = async (renderer: TextureRenderer, state: TextureState): Promise<void> => {
    const calls = source.load.mock.calls.length
    renderer.apply(state)
    await vi.waitFor(() => expect(source.load).toHaveBeenCalledTimes(calls + 1))
  }

  /**
   * The cache takes an asset id and builds the URL itself. Handing it one already built made it
   * encode the whole `scenario://` URL as an id, and the sky could never load.
   */
  it('asks for the sky by asset id, not by a URL it built itself', async () => {
    await applied(mounted(), skyOf('sky-1'))

    expect(source.load).toHaveBeenCalledWith('scenario://asset/sky-1')
  })

  /** The branch a refactor would silently regress by moving the release inside the sky path. */
  it('frees its sky when the preview goes back to the studio', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))

    renderer.apply(newTexture())

    expect(source.freed[0]).toHaveBeenCalled()
  })

  it('loads a sky once, however many times the same state comes back', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))
    renderer.apply(skyOf('sky-1'))

    expect(source.load).toHaveBeenCalledTimes(1)
  })

  /** The cache counts references: a sky nobody displays any more is memory the viewport lacks. */
  it('frees the previous sky when another one is chosen', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))

    await applied(renderer, skyOf('sky-2'))

    // After the swap, never before: until then the old texture is what the background holds.
    await vi.waitFor(() => expect(source.freed[0]).toHaveBeenCalled())
    expect(source.freed[1]).not.toHaveBeenCalled()
  })

  it('frees its sky when it goes away', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))

    renderer.dispose()

    expect(source.freed[0]).toHaveBeenCalled()
  })

  /**
   * The cavity mask reaches the shader through a uniform of its own, so it takes the one path in
   * this engine that no material slot walks. Covered channel by channel rather than for `edge`
   * alone: the loop is what decides, and it is the loop a refactor narrows by accident.
   */
  describe('the channels of a texture', () => {
    /**
     * All eight at once rather than one `it.each` per channel: it is the loop over `PBR_CHANNELS`
     * that decides, and proving it handles them *together* is what a per-channel case cannot say.
     */
    it('loads every channel, slot or no slot', async () => {
      const renderer = mounted()
      renderer.apply(everyChannel())

      await vi.waitFor(() => expect(source.load).toHaveBeenCalledTimes(PBR_CHANNELS.length))
      for (const channel of PBR_CHANNELS) {
        expect(source.load).toHaveBeenCalledWith(`scenario://asset/${channel}-1`)
      }
    })

    /**
     * Emptied while the eight loads are still in flight, which is the harder half: the cache frees
     * what arrives for a holder that no longer exists, so the disposal lands on resolution rather
     * than on the release — hence waiting for it instead of asserting straight away.
     */
    it('frees every channel when the texture is emptied', async () => {
      const renderer = mounted()
      renderer.apply(everyChannel())
      await vi.waitFor(() => expect(source.freed).toHaveLength(PBR_CHANNELS.length))

      renderer.apply(newTexture())

      await vi.waitFor(() => {
        for (const freed of source.freed) expect(freed).toHaveBeenCalled()
      })
    })

    it('frees the cavity mask on dispose, which no slot would have done for it', async () => {
      const renderer = mounted()
      expect(slotFor('edge')).toBeNull()
      await applied(renderer, channelOf('edge', 'edge-1'))

      renderer.dispose()

      expect(source.freed[0]).toHaveBeenCalled()
    })

    it('swaps a channel for another asset without holding on to the first', async () => {
      const renderer = mounted()
      await applied(renderer, channelOf('edge', 'edge-1'))

      await applied(renderer, channelOf('edge', 'edge-2'))

      await vi.waitFor(() => expect(source.freed[0]).toHaveBeenCalled())
      expect(source.freed[1]).not.toHaveBeenCalled()
    })

    /**
     * Reads the texture the source handed out, which is the only way from here to tell a channel
     * that reached the shader from one that was merely loaded and dropped: repeat, offset and
     * rotation are applied to every map at once, so a channel left out drifts away from the rest.
     */
    it('applies the tiling of the material to every map at once', async () => {
      const renderer = mounted()
      const state = everyChannel()
      state.material.tiling = { x: 3, y: 3 }
      renderer.apply(state)
      await vi.waitFor(() => expect(source.load).toHaveBeenCalledTimes(PBR_CHANNELS.length))

      for (const result of source.load.mock.results) {
        const map = await result.value
        await vi.waitFor(() => expect(map.repeat.x).toBe(3))
        expect(map.wrapS).toBe(RepeatWrapping)
        expect(map.center.x).toBe(0.5)
      }
    })

    /**
     * The regression this exists for, measured rather than supposed: `Texture.needsUpdate` bumps
     * `source.needsUpdate` too, so three re-uploads the pixels AND rebuilds the mip chain. Set on
     * every `apply`, eight 2K channels came to 128 MB of upload per frame of any drag — four to ten
     * times the whole frame budget, for a slider that has nothing to do with tiling.
     *
     * Nothing here needs it: `matrixAutoUpdate` is on, so three refreshes the uv matrix itself.
     */
    it('never asks for a re-upload of pixels it has not changed', async () => {
      const renderer = mounted()
      await applied(renderer, channelOf('baseColor', 'base-1'))
      const map = await source.load.mock.results[0]?.value

      // Whatever the first render needed is spent; from here on a version bump IS a re-upload.
      const version = map.version

      // The tiling moves, so the pass really does run and really does rewrite `repeat` — which is
      // the case that matters: placing a map again must not cost its pixels. Asserted on a state
      // that does NOT move would only have re-tested the guard above it.
      const moved = channelOf('baseColor', 'base-1')
      moved.material.tiling = { x: 2, y: 2 }
      renderer.apply(moved)

      expect(map.repeat.x).toBe(2)
      expect(map.version).toBe(version)
    })

    it('leaves the maps alone entirely when the tiling has not moved', async () => {
      const renderer = mounted()
      await applied(renderer, channelOf('baseColor', 'base-1'))
      const map = await source.load.mock.results[0]?.value
      map.repeat.set(9, 9)

      // Same tiling as before, so the pass must not run — not even to write the same values back.
      renderer.apply(channelOf('baseColor', 'base-1'))

      expect(map.repeat.x).toBe(9)
    })

    it('still follows the tiling when it does move', async () => {
      const renderer = mounted()
      await applied(renderer, channelOf('baseColor', 'base-1'))
      const map = await source.load.mock.results[0]?.value

      const moved = channelOf('baseColor', 'base-1')
      moved.material.tiling = { x: 4, y: 2 }
      renderer.apply(moved)

      expect([map.repeat.x, map.repeat.y]).toEqual([4, 2])
    })

    /**
     * A 4K picture decodes for hundreds of milliseconds. The state that started the load is stale
     * by the time it resolves, and reapplying it snapped every other map back to a tiling the user
     * had already left.
     */
    it('places a map that arrives late on the tiling in force, not the one it was asked under', async () => {
      const renderer = mounted()
      const asked = channelOf('baseColor', 'base-1')
      renderer.apply(asked)

      const moved = channelOf('baseColor', 'base-1')
      moved.material.tiling = { x: 5, y: 5 }
      renderer.apply(moved)

      const map = await source.load.mock.results[0]?.value
      await vi.waitFor(() => expect(map.repeat.x).toBe(5))
    })

    it('asks once for a channel, however many times the same state comes back', async () => {
      const renderer = mounted()
      await applied(renderer, channelOf('roughness', 'rough-1'))

      renderer.apply(channelOf('roughness', 'rough-1'))

      expect(source.load).toHaveBeenCalledTimes(1)
    })
  })
})
