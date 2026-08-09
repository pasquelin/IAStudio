import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { EnvironmentRef } from '@shared/domain/scene'
import { createTextureCache } from '../scene/texture-cache'
import { createSkyBinding } from './sky-binding'
import { fakeEnvironment, fakeTextureSource } from './viewport-fixtures'

const SKY: EnvironmentRef = { kind: 'skybox', assetId: 'sky-1' }
const OTHER: EnvironmentRef = { kind: 'skybox', assetId: 'sky-2' }
const THIRD: EnvironmentRef = { kind: 'skybox', assetId: 'sky-3' }
const STUDIO: EnvironmentRef = { kind: 'studio' }

describe('createSkyBinding', () => {
  let source: ReturnType<typeof fakeTextureSource>
  let paint: Mock<() => void>

  beforeEach(() => {
    source = fakeTextureSource()
    paint = vi.fn()
  })

  /** The failure port: what a cache tells its engine is that engine's business, not this one's. */
  const silent = () => {}

  const binding = () => createSkyBinding(createTextureCache(source.load, silent), paint)

  it('asks for the sky by asset id, and prefilters it once it has decoded', async () => {
    const environment = fakeEnvironment()
    await binding().apply(environment, SKY)

    expect(source.load).toHaveBeenCalledWith('scenario://asset/sky-1')
    expect(environment.setTexture).toHaveBeenCalled()
    expect(environment.refresh).toHaveBeenCalled()
  })

  it('reads the file once, however many times the same choice comes back', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    await sky.apply(environment, SKY)
    await sky.apply(environment, SKY)

    expect(source.load).toHaveBeenCalledTimes(1)
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
    expect(source.freed[0]).not.toHaveBeenCalled()

    await sky.apply(environment, OTHER)
    expect(source.freed[0]).toHaveBeenCalled()
    expect(source.freed[1]).not.toHaveBeenCalled()
  })

  it('frees the sky it holds when the viewport goes away', async () => {
    const sky = binding()
    await sky.apply(fakeEnvironment(), SKY)

    sky.release()

    expect(source.freed[0]).toHaveBeenCalled()
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

  /**
   * Two skies never showed this: the first one holds no predecessor, so nothing is owed. It takes
   * a third to overtake a choice that is *already* carrying one — and a sky whose reference is
   * never given back stays in GPU memory until the engine is disposed of.
   */
  it('gives back the sky an overtaken choice was carrying', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    const first = sky.apply(environment, SKY)
    const second = sky.apply(environment, OTHER)
    const third = sky.apply(environment, THIRD)
    await Promise.all([first, second, third])

    expect(source.freed[0]).toHaveBeenCalled()
    expect(source.freed[1]).toHaveBeenCalled()
    expect(source.freed[2]).not.toHaveBeenCalled()
    expect(sky.showsSky()).toBe(true)
  })

  /**
   * The mirror risk of giving a carried reference back: hand back one too many and the sky on
   * screen is disposed of under the frame that is drawing it. Coming back to a sky while another
   * decodes is the case where the same asset is both carried and wanted.
   */
  it('keeps the sky that came back while another was decoding', async () => {
    const sky = binding()
    const environment = fakeEnvironment()

    const first = sky.apply(environment, SKY)
    const second = sky.apply(environment, OTHER)
    const back = sky.apply(environment, SKY)
    await Promise.all([first, second, back])

    expect(source.freed[0]).not.toHaveBeenCalled()
    expect(source.freed[1]).toHaveBeenCalled()
    expect(sky.showsSky()).toBe(true)
  })

  it('shows nothing rather than throwing when the file cannot be read', async () => {
    const sky = createSkyBinding(
      createTextureCache(async () => {
        throw new Error('gone')
      }, silent),
      paint,
    )
    const environment = fakeEnvironment()

    await sky.apply(environment, SKY)

    expect(environment.refresh).not.toHaveBeenCalled()
  })
})
