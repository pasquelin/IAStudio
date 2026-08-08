import { EquirectangularReflectionMapping, Scene, Texture, type WebGLRenderer } from 'three'
import type * as ThreeModule from 'three'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createEnvironment } from './environment'

/**
 * `PMREMGenerator` prefilters by rendering a mip chain, which needs a GL context jsdom cannot
 * give. Replaced by a generator that hands back a target carrying a recognisable texture, so
 * the tests can follow which map the scene ends up reading and when the previous one is freed.
 */
const targets: { texture: Texture; dispose: ReturnType<typeof vi.fn>; boundWhenFreed: boolean }[] =
  []

let scene = new Scene()

const newTarget = (): (typeof targets)[number] => {
  const target = {
    texture: new Texture(),
    // Recorded at the moment of the call: whether the scene was still reading this map when it
    // was freed is the whole point, and it cannot be read afterwards.
    dispose: vi.fn(() => {
      target.boundWhenFreed = scene.environment === target.texture
    }),
    boundWhenFreed: false,
  }
  targets.push(target)
  return target
}

const fromEquirectangular = vi.fn(() => newTarget())
const fromScene = vi.fn(() => newTarget())
const disposeGenerator = vi.fn()
const compileEquirectangularShader = vi.fn()

vi.mock('three', async importOriginal => ({
  ...(await importOriginal<typeof ThreeModule>()),
  PMREMGenerator: class {
    compileEquirectangularShader = compileEquirectangularShader
    fromEquirectangular = fromEquirectangular
    fromScene = fromScene
    dispose = disposeGenerator
  },
}))

describe('the environment of a viewport', () => {
  let requestRender: Mock<() => void>

  beforeEach(() => {
    targets.length = 0
    vi.clearAllMocks()
    scene = new Scene()
    requestRender = vi.fn<() => void>()
  })

  // `as`: the generator is mocked above, and it is the only thing the renderer is handed to.
  const environmentOf = (): ReturnType<typeof createEnvironment> =>
    createEnvironment({} as WebGLRenderer, scene, requestRender)

  it('shows a picture behind the scene, on the mapping a sky is drawn with', () => {
    const environment = environmentOf()
    const sky = new Texture()

    environment.setTexture(sky)

    expect(sky.mapping).toBe(EquirectangularReflectionMapping)
    expect(scene.background).toBe(sky)
    expect(requestRender).toHaveBeenCalled()
  })

  it('takes the picture away when the source goes', () => {
    const environment = environmentOf()
    environment.setTexture(new Texture())

    environment.setTexture(null)

    expect(scene.background).toBeNull()
  })

  /**
   * Hiding the background must not lose the source: the reflections keep coming from it, and
   * showing it again has to work without the caller handing the texture over a second time.
   */
  it('keeps the source while the background is hidden, and puts it back', () => {
    const environment = environmentOf()
    const sky = new Texture()
    environment.setTexture(sky)

    environment.setBackgroundVisible(false)
    expect(scene.background).toBeNull()

    environment.setBackgroundVisible(true)
    expect(scene.background).toBe(sky)
  })

  /** A texture handed over while the background is hidden must not turn it back on. */
  it('leaves the background hidden when a new source arrives', () => {
    const environment = environmentOf()
    environment.setBackgroundVisible(false)

    environment.setTexture(new Texture())

    expect(scene.background).toBeNull()
  })

  it('prefilters the source into what the materials reflect', () => {
    const environment = environmentOf()
    const sky = new Texture()
    environment.setTexture(sky)

    environment.refresh()

    expect(fromEquirectangular).toHaveBeenCalledWith(sky)
    expect(scene.environment).toBe(targets[0]?.texture)
  })

  /**
   * The order is the point, not the disposal: freeing the old target before the new one is in
   * place leaves every material reflecting freed GPU memory for a frame.
   */
  it('frees the previous map only once the new one is in place', () => {
    const environment = environmentOf()
    environment.setTexture(new Texture())
    environment.refresh()

    expect(targets[0]?.dispose).not.toHaveBeenCalled()

    environment.refresh()

    expect(targets[0]?.dispose).toHaveBeenCalled()
    expect(targets[0]?.boundWhenFreed).toBe(false)
    expect(scene.environment).toBe(targets[1]?.texture)
  })

  it('reflects nothing when there is no source to prefilter', () => {
    const environment = environmentOf()

    environment.refresh()

    expect(fromEquirectangular).not.toHaveBeenCalled()
    expect(scene.environment).toBeNull()
  })

  /** No HDRI ships with the studio: a brand new project still has to light a material. */
  it('lights the scene from a neutral room when asked for the studio', () => {
    const environment = environmentOf()

    environment.setStudio()

    expect(fromScene).toHaveBeenCalled()
    expect(scene.environment).toBe(targets[0]?.texture)
  })

  it('frees the previous map when the studio replaces it, and not before', () => {
    const environment = environmentOf()
    environment.setTexture(new Texture())
    environment.refresh()

    environment.setStudio()

    expect(targets[0]?.dispose).toHaveBeenCalled()
    expect(targets[0]?.boundWhenFreed).toBe(false)
  })

  /** Both, or the sun sits in one place and lights from another. */
  it('turns the picture and what the scene reflects by the same angle', () => {
    const environment = environmentOf()

    environment.setRotation(1.5)

    expect(scene.backgroundRotation.y).toBe(1.5)
    expect(scene.environmentRotation.y).toBe(1.5)
  })

  it('dims the picture and what the scene reflects together', () => {
    const environment = environmentOf()

    environment.setIntensity(0.4)

    expect(scene.backgroundIntensity).toBe(0.4)
    expect(scene.environmentIntensity).toBe(0.4)
  })

  it('leaves the scene holding nothing, and frees what it built', () => {
    const environment = environmentOf()
    environment.setTexture(new Texture())
    environment.refresh()

    environment.dispose()

    expect(scene.background).toBeNull()
    expect(scene.environment).toBeNull()
    expect(targets[0]?.dispose).toHaveBeenCalled()
    expect(disposeGenerator).toHaveBeenCalled()
  })

  it('disposes without a map to free', () => {
    const environment = environmentOf()

    environment.dispose()

    expect(disposeGenerator).toHaveBeenCalled()
  })
})
