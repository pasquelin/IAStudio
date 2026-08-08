import { Texture } from 'three'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { EnvironmentRef } from '@shared/domain/scene'
import { createTextureCache } from '../scene/texture-cache'
import type { ViewportEnvironment } from './environment'
import { createSkyBinding } from './sky-binding'

const SKY: EnvironmentRef = { kind: 'skybox', assetId: 'sky-1' }
const OTHER: EnvironmentRef = { kind: 'skybox', assetId: 'sky-2' }
const STUDIO: EnvironmentRef = { kind: 'studio' }

function fakeEnvironment(): ViewportEnvironment {
  return {
    setTexture: vi.fn(),
    refresh: vi.fn(),
    setStudio: vi.fn(),
    setIntensity: vi.fn(),
    setRotation: vi.fn(),
    setBackgroundVisible: vi.fn(),
    dispose: vi.fn(),
  }
}

describe('createSkyBinding', () => {
  let freed: ReturnType<typeof vi.spyOn>[]
  let load: Mock<(url: string) => Promise<Texture>>
  let paint: Mock<() => void>

  beforeEach(() => {
    freed = []
    load = vi.fn(async () => {
      const texture = new Texture()
      // The cache disposes a texture the moment its last reference goes — what these watch.
      freed.push(vi.spyOn(texture, 'dispose'))
      return texture
    })
    paint = vi.fn()
  })

  const binding = () => createSkyBinding(createTextureCache(load), paint)

  it('asks for the sky by asset id, and prefilters it once it has decoded', async () => {
    const environment = fakeEnvironment()
    await binding().apply(environment, SKY)

    expect(load).toHaveBeenCalledWith('scenario://asset/sky-1')
    expect(environment.setTexture).toHaveBeenCalled()
    expect(environment.refresh).toHaveBeenCalled()
  })

  it('reads the file once, however many times the same choice comes back', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    await sky.apply(environment, SKY)
    await sky.apply(environment, SKY)

    expect(load).toHaveBeenCalledTimes(1)
  })

  /**
   * `setStudio` lights the scene but hangs nothing behind it. Without repainting, the backdrop
   * stayed on the texture that was just cleared — which reads as a viewport gone black.
   */
  it('paints a backdrop again when it goes back to the studio', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    await sky.apply(environment, SKY)
    paint.mockClear()
    await sky.apply(environment, STUDIO)

    expect(environment.setTexture).toHaveBeenLastCalledWith(null)
    expect(environment.setStudio).toHaveBeenCalled()
    expect(paint).toHaveBeenCalled()
  })

  it('says whether a sky owns the background, which is what stops a repaint over it', async () => {
    const sky = binding()
    expect(sky.showsSky()).toBe(false)

    await sky.apply(fakeEnvironment(), SKY)
    expect(sky.showsSky()).toBe(true)
  })

  /**
   * Released before its replacement is in place, a sky is disposed while still bound to
   * `scene.background`: three.js re-uploads it on the next frame, with nothing left to free it.
   */
  it('frees the previous sky only once the new one is shown', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    await sky.apply(environment, SKY)
    expect(freed[0]).not.toHaveBeenCalled()

    await sky.apply(environment, OTHER)
    expect(freed[0]).toHaveBeenCalled()
    expect(freed[1]).not.toHaveBeenCalled()
  })

  it('frees the sky it holds when the viewport goes away', async () => {
    const sky = binding()
    await sky.apply(fakeEnvironment(), SKY)

    sky.release()

    expect(freed[0]).toHaveBeenCalled()
    expect(sky.showsSky()).toBe(false)
  })

  // A sky chosen while another is still decoding must not be overwritten by the slower one.
  it('lets the last choice win, whatever order they decode in', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    const first = sky.apply(environment, SKY)
    const second = sky.apply(environment, OTHER)
    await Promise.all([first, second])

    expect(sky.showsSky()).toBe(true)
    expect(environment.refresh).toHaveBeenCalledTimes(1)
  })

  it('shows nothing rather than throwing when the file cannot be read', async () => {
    const sky = createSkyBinding(
      createTextureCache(async () => {
        throw new Error('gone')
      }),
      paint,
    )
    const environment = fakeEnvironment()

    await sky.apply(environment, SKY)

    expect(environment.refresh).not.toHaveBeenCalled()
  })
})
