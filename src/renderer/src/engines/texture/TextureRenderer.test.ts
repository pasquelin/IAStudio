import { Texture } from 'three'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ViewportEngine } from '../viewport/ViewportEngine'
import type { ViewportEnvironment } from '../viewport/environment'
import { TextureRenderer } from './TextureRenderer'
import { newTexture, type TextureState } from './texture-state'

/**
 * The environment is the one part of this engine a unit test can reach: `mount` builds a real
 * `WebGLRenderer`, which jsdom cannot give (`test-setup` hands back no canvas context). Stubbing
 * the viewport's mount and its `gl` accessor is enough — nothing here dereferences the renderer.
 */
vi.mock('../viewport/environment', () => ({
  // `satisfies`: a member added to the port and called by the engine must fail to compile here,
  // rather than at run time on an opaque "is not a function".
  createEnvironment: () =>
    ({
      setTexture: vi.fn(),
      refresh: vi.fn(),
      setStudio: vi.fn(),
      setIntensity: vi.fn(),
      setRotation: vi.fn(),
      setBackgroundVisible: vi.fn(),
      dispose: vi.fn(),
    }) satisfies ViewportEnvironment,
}))

const skyOf = (assetId: string): TextureState => {
  const state = newTexture()
  state.preview.environment = { kind: 'skybox', assetId }
  return state
}

describe('the environment of a texture preview', () => {
  let freed: ReturnType<typeof vi.spyOn>[]
  let loadTexture: Mock<(url: string) => Promise<Texture>>
  let host: HTMLElement

  beforeEach(() => {
    freed = []
    loadTexture = vi.fn(async () => {
      const texture = new Texture()
      // The cache disposes a texture the moment its last reference goes — what these watch.
      freed.push(vi.spyOn(texture, 'dispose'))
      return texture
    })
    vi.spyOn(ViewportEngine.prototype, 'mount').mockImplementation(() => {})
    // `as`: `mount` only checks that a renderer exists before handing it to `createEnvironment`,
    // which is mocked above — so nothing ever reads a field of it.
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue({} as never)
    host = document.createElement('div')
  })

  const mounted = (): TextureRenderer => {
    const renderer = new TextureRenderer({ loadTexture })
    renderer.mount(host)
    return renderer
  }

  const applied = async (renderer: TextureRenderer, state: TextureState): Promise<void> => {
    const calls = loadTexture.mock.calls.length
    renderer.apply(state)
    await vi.waitFor(() => expect(loadTexture).toHaveBeenCalledTimes(calls + 1))
  }

  /**
   * The cache takes an asset id and builds the URL itself. Handing it one already built made it
   * encode the whole `scenario://` URL as an id, and the sky could never load.
   */
  it('asks for the sky by asset id, not by a URL it built itself', async () => {
    await applied(mounted(), skyOf('sky-1'))

    expect(loadTexture).toHaveBeenCalledWith('scenario://asset/sky-1')
  })

  /** The branch a refactor would silently regress by moving the release inside the sky path. */
  it('frees its sky when the preview goes back to the studio', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))

    renderer.apply(newTexture())

    expect(freed[0]).toHaveBeenCalled()
  })

  it('loads a sky once, however many times the same state comes back', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))
    renderer.apply(skyOf('sky-1'))

    expect(loadTexture).toHaveBeenCalledTimes(1)
  })

  /** The cache counts references: a sky nobody displays any more is memory the viewport lacks. */
  it('frees the previous sky when another one is chosen', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))

    await applied(renderer, skyOf('sky-2'))

    expect(freed[0]).toHaveBeenCalled()
    expect(freed[1]).not.toHaveBeenCalled()
  })

  it('frees its sky when it goes away', async () => {
    const renderer = mounted()
    await applied(renderer, skyOf('sky-1'))

    renderer.dispose()

    expect(freed[0]).toHaveBeenCalled()
  })
})
