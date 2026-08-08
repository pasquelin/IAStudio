import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepeatWrapping } from 'three'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { fakeEnvironment, fakeTextureSource } from '../viewport/viewport-fixtures'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { TextureRenderer } from './TextureRenderer'
import { newTexture, slotFor, type ChannelMap, type TextureState } from './texture-state'

const MAP: ChannelMap = { assetId: 'map-1', origin: 'generated', width: 512, height: 512 }

const channelOf = (channel: PbrChannel, assetId: string): TextureState => {
  const state = newTexture()
  state.channels[channel] = { ...MAP, assetId }
  return state
}

/**
 * The environment is the one part of this engine a unit test can reach: `mount` builds a real
 * `WebGLRenderer`, which jsdom cannot give (`test-setup` hands back no canvas context). Stubbing
 * the viewport's mount and its `gl` accessor is enough — nothing here dereferences the renderer.
 */
vi.mock('../viewport/environment', () => ({ createEnvironment: () => fakeEnvironment() }))

const skyOf = (assetId: string): TextureState => {
  const state = newTexture()
  state.preview.environment = { kind: 'skybox', assetId }
  return state
}

describe('the environment of a texture preview', () => {
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
    it.each(PBR_CHANNELS)('loads %s, slot or no slot', async channel => {
      await applied(mounted(), channelOf(channel, `${channel}-1`))

      expect(source.load).toHaveBeenCalledWith(`scenario://asset/${channel}-1`)
    })

    it.each(PBR_CHANNELS)('frees %s when it is taken out of the texture', async channel => {
      const renderer = mounted()
      await applied(renderer, channelOf(channel, `${channel}-1`))

      renderer.apply(newTexture())

      expect(source.freed[0]).toHaveBeenCalled()
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
    it.each(PBR_CHANNELS)('applies the tiling of the material to %s', async channel => {
      const renderer = mounted()
      const state = channelOf(channel, `${channel}-1`)
      state.material.tiling = { x: 3, y: 3 }
      await applied(renderer, state)

      const map = await source.load.mock.results[0]?.value
      await vi.waitFor(() => expect(map.repeat.x).toBe(3))
      expect(map.wrapS).toBe(RepeatWrapping)
      expect(map.center.x).toBe(0.5)
    })

    it('asks once for a channel, however many times the same state comes back', async () => {
      const renderer = mounted()
      await applied(renderer, channelOf('roughness', 'rough-1'))

      renderer.apply(channelOf('roughness', 'rough-1'))

      expect(source.load).toHaveBeenCalledTimes(1)
    })
  })
})
