import { EquirectangularReflectionMapping, Scene, Texture, type WebGLRenderer } from 'three'
import type * as ThreeModule from 'three'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createEnvironment, type ViewportEnvironment } from './environment'

/**
 * `PMREMGenerator` prefilters by rendering a mip chain, which needs a GL context jsdom cannot
 * give. The stand-in hands back a target carrying a recognisable texture, so the tests can
 * follow which map the scene ends up reading and when the previous one is freed.
 */
type FakeTarget = { texture: Texture; dispose: Mock<() => void>; boundWhenFreed: boolean }

const targets: FakeTarget[] = []

/** The scene the environment under test was handed, captured rather than assumed. */
let watched: Scene | null = null

const newTarget = (): FakeTarget => {
  const target: FakeTarget = {
    texture: new Texture(),
    // Recorded at the moment of the call: whether the scene was still reading this map when it
    // was freed cannot be known afterwards, and that is the whole question.
    dispose: vi.fn(() => {
      target.boundWhenFreed = watched?.environment === target.texture
    }),
    boundWhenFreed: false,
  }
  targets.push(target)
  return target
}

const fromEquirectangular = vi.fn(() => newTarget())
const fromScene = vi.fn(() => newTarget())
const disposeGenerator = vi.fn()

vi.mock('three', async importOriginal => ({
  ...(await importOriginal<typeof ThreeModule>()),
  PMREMGenerator: class {
    compileEquirectangularShader(): void {}
    fromEquirectangular = fromEquirectangular
    fromScene = fromScene
    dispose = disposeGenerator
  },
}))

describe('the environment of a viewport', () => {
  let scene: Scene
  let requestRender: Mock<() => void>

  beforeEach(() => {
    targets.length = 0
    vi.clearAllMocks()
    scene = new Scene()
    watched = scene
    requestRender = vi.fn<() => void>()
  })

  // `as`: the generator is mocked above, and it is the only thing the renderer is handed to.
  const environmentOf = (): ViewportEnvironment =>
    createEnvironment({} as WebGLRenderer, scene, requestRender)

  const withPrefilteredMap = (): ViewportEnvironment => {
    const environment = environmentOf()
    environment.setTexture(new Texture())
    environment.refresh()
    return environment
  }

  it('shows a picture behind the scene, on the mapping a sky is drawn with', () => {
    const environment = environmentOf()
    const sky = new Texture()

    environment.setTexture(sky)

    expect(sky.mapping).toBe(EquirectangularReflectionMapping)
    expect(scene.background).toBe(sky)
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

  it('softens the picture without touching what the materials reflect', () => {
    const environment = withPrefilteredMap()
    const reflected = scene.environment

    environment.setBackgroundBlur(0.6)

    expect(scene.backgroundBlurriness).toBe(0.6)
    expect(scene.environment).toBe(reflected)
  })

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
    const environment = withPrefilteredMap()
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

  // No HDRI ships with the studio: a brand new project still has to light a material.
  it('lights the scene from a neutral room when asked for the studio', () => {
    const environment = environmentOf()

    environment.setStudio()

    expect(fromScene).toHaveBeenCalled()
    expect(scene.environment).toBe(targets[0]?.texture)
  })

  it('frees the previous map when the studio replaces it, and not before', () => {
    const environment = withPrefilteredMap()

    environment.setStudio()

    expect(targets[0]?.dispose).toHaveBeenCalled()
    expect(targets[0]?.boundWhenFreed).toBe(false)
  })

  // Both, or the sun sits in one place and lights from another.
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

  /**
   * The viewport only draws when something asks it to. A setter that changes what is on screen
   * without asking leaves the panel showing the previous value until some unrelated frame.
   */
  it('asks for a frame after every change it makes', () => {
    const environment = environmentOf()
    const changes: (() => void)[] = [
      () => environment.setTexture(new Texture()),
      () => environment.refresh(),
      () => environment.setStudio(),
      () => environment.setIntensity(0.5),
      () => environment.setRotation(0.5),
      () => environment.setBackgroundVisible(false),
    ]

    for (const change of changes) {
      requestRender.mockClear()
      change()
      expect(requestRender).toHaveBeenCalled()
    }
  })

  it('leaves the scene holding nothing, and frees what it built', () => {
    const environment = withPrefilteredMap()

    environment.dispose()

    expect(scene.background).toBeNull()
    expect(scene.environment).toBeNull()
    expect(targets[0]?.dispose).toHaveBeenCalled()
    expect(disposeGenerator).toHaveBeenCalled()
  })

  it('disposes without a map to free', () => {
    environmentOf().dispose()

    expect(disposeGenerator).toHaveBeenCalled()
  })
})
