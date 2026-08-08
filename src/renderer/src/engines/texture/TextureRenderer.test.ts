import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeEnvironment, fakeTextureSource } from '../viewport/viewport-fixtures'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { TextureRenderer } from './TextureRenderer'
import { newTexture, type TextureState } from './texture-state'

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
})
