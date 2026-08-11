import { DirectionalLight, Texture, WebGLRenderTarget } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { SphericalAngles } from '@shared/domain/angles'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import type * as AdjustModule from '../gpu/passes/adjust'
import type { AdjustPass } from '../gpu/passes/adjust'
import type { GpuPipeline } from '../gpu/GpuPipeline'
import type * as TestObjectsModule from '../viewport/test-objects'
import type { TestObjects } from '../viewport/test-objects'
import { fakeEnvironment, fakeTextureSource } from '../viewport/viewport-fixtures'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { SkyboxRenderer } from './SkyboxRenderer'

// The environment prefilters a mip chain and the pipeline draws into a target: both need the GL
// context jsdom has none of. `gestureFor` stays real — the wiring to it is what this proves.
const environment = fakeEnvironment()

const pipeline = {
  renderTo: vi.fn(),
  renderToScreen: vi.fn(),
  createTarget: vi.fn(() => new WebGLRenderTarget(4, 2)),
  dispose: vi.fn(),
} satisfies GpuPipeline

/**
 * The grading pass is what the whole engine exists to feed, so its inputs and its disposal are
 * watched. The real pass is kept underneath — it is a `ShaderMaterial`, which jsdom builds fine
 * — so the material handed to the pipeline stays the real one.
 */
let adjust: AdjustPass

/**
 * Kept real underneath — they are three meshes in a group, which jsdom builds fine — and held
 * onto so a test can read what the viewport would actually draw.
 */
let probes: TestObjects

vi.mock('../viewport/test-objects', async importOriginal => {
  const actual = await importOriginal<typeof TestObjectsModule>()
  return {
    ...actual,
    createTestObjects: (options: Parameters<typeof actual.createTestObjects>[0]) => {
      probes = actual.createTestObjects(options)
      return probes
    },
  }
})

vi.mock('../viewport/environment', () => ({ createEnvironment: () => environment }))
vi.mock('../gpu/GpuPipeline', () => ({ createGpuPipeline: () => pipeline }))
vi.mock('../gpu/passes/adjust', async importOriginal => {
  const actual = await importOriginal<typeof AdjustModule>()
  return {
    ...actual,
    createAdjustPass: () => {
      adjust = {
        ...actual.createAdjustPass(),
        setSource: vi.fn(),
        setAdjustments: vi.fn(),
        dispose: vi.fn(),
      }
      return adjust
    },
  }
})

const host = document.createElement('div')

/** Azimuth `0` aims at `+Z`, which is where a ray through the centre of the frame goes. */
const SUN_AHEAD = 0
const SUN_BEHIND = Math.PI

const skyOf = (assetId: string): SkyboxContent => {
  const content = createSkyboxContent()
  content.source = { assetId }
  return content
}

const sunAt = (azimuth: number): SkyboxContent => {
  const content = createSkyboxContent()
  content.sun = { ...content.sun, elevation: 0, azimuth }
  return content
}

describe('the renderer of a skybox', () => {
  let onSunChange: Mock<(angles: SphericalAngles) => void>
  let source: ReturnType<typeof fakeTextureSource>
  let canvas: HTMLCanvasElement
  let camera: ViewportEngine['camera'] | null
  let disposeViewport: ReturnType<typeof vi.spyOn>
  let ndc: { x: number; y: number } | null
  let mountedRenderers: SkyboxRenderer[]

  beforeEach(() => {
    vi.clearAllMocks()
    // Fake from the start: the prefilter runs on a timer otherwise, and one left pending by a
    // test fires inside the next and refreshes an environment nobody asked.
    vi.useFakeTimers()
    onSunChange = vi.fn<(angles: SphericalAngles) => void>()
    mountedRenderers = []
    source = fakeTextureSource()
    canvas = document.createElement('canvas')
    camera = null
    ndc = { x: 0, y: 0 }

    vi.spyOn(ViewportEngine.prototype, 'mount').mockImplementation(() => {})
    disposeViewport = vi.spyOn(ViewportEngine.prototype, 'dispose')
    // `as`: neither the pipeline nor the environment is real here, and nothing else reads it.
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue({} as never)
    vi.spyOn(ViewportEngine.prototype, 'canvas', 'get').mockReturnValue(canvas)
    vi.spyOn(ViewportEngine.prototype, 'pointerNdcOf').mockImplementation(function (
      this: ViewportEngine,
    ) {
      camera = this.camera
      // What a drawn frame would have done. Without it the camera's world matrix is still the
      // identity, every ray points down -Z whatever the camera was aimed at, and the gesture
      // the engine picks would be decided by an artefact of the test rather than by the sun.
      this.camera.updateMatrixWorld()
      return ndc
    })
  })

  afterEach(() => {
    // `mount` puts pointer listeners on `window` and only `dispose` takes them off. A renderer
    // left mounted keeps answering gestures in the tests that follow — which silently turned
    // four of the negative assertions below green for the wrong reason.
    for (const renderer of mountedRenderers) renderer.dispose()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const mounted = (): SkyboxRenderer => {
    const renderer = new SkyboxRenderer({ onSunChange, loadTexture: source.load })
    renderer.mount(host)
    mountedRenderers.push(renderer)
    return renderer
  }

  const unmountable = (): SkyboxRenderer => {
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue(null)
    return mounted()
  }

  /**
   * Waits for the grading pass, not for the load: `apply` returns before the texture arrives,
   * and a test that only waits for the request runs while the engine still holds no picture.
   */
  const applied = async (renderer: SkyboxRenderer, content: SkyboxContent): Promise<void> => {
    const graded = pipeline.renderTo.mock.calls.length
    renderer.apply(content)
    // Draining the microtasks, not polling: `vi.waitFor` probes on a real interval and advances
    // the fake clock 50 ms per probe, which both costs wall time and eats into the quiet delay
    // the prefilter tests measure.
    await vi.advanceTimersByTimeAsync(0)
    expect(pipeline.renderTo).toHaveBeenCalledTimes(graded + 1)
  }

  const gradedTarget = (): WebGLRenderTarget | undefined =>
    pipeline.createTarget.mock.results[0]?.value

  const pointerAt = (type: string, x: number, y: number, button = 0): PointerEvent =>
    new PointerEvent(type, { clientX: x, clientY: y, button, bubbles: true })

  describe('mounting', () => {
    it('builds nothing when the viewport has no renderer to share', () => {
      unmountable()

      expect(pipeline.createTarget).not.toHaveBeenCalled()
    })

    it('grades into a half-float target', () => {
      mounted()

      expect(pipeline.createTarget).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'float',
      )
    })
  })

  describe('the source picture', () => {
    // Handing the cache a URL it had built itself made it encode the whole `scenario://` address
    // as an asset id, and no sky could ever load.
    it('asks for the sky by asset id, not by a URL it built itself', async () => {
      await applied(mounted(), skyOf('sky-1'))

      expect(source.load).toHaveBeenCalledWith('scenario://asset/sky-1')
    })

    it('grades the picture it was given into the background', async () => {
      await applied(mounted(), skyOf('sky-1'))

      expect(environment.setTexture).toHaveBeenCalledWith(gradedTarget()?.texture)
    })

    it('hands the picture and the adjustments to the grading pass', async () => {
      const content = skyOf('sky-1')
      content.adjustments = { ...content.adjustments, exposure: 1.7 }

      await applied(mounted(), content)

      expect(adjust.setAdjustments).toHaveBeenCalledWith(content.adjustments)
      expect(adjust.setSource).toHaveBeenCalledWith(expect.any(Texture))
      expect(pipeline.renderTo).toHaveBeenCalledWith(adjust.material, gradedTarget())
    })

    it('clears the grading source when the picture goes', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(createSkyboxContent())

      expect(adjust.setSource).toHaveBeenLastCalledWith(null)
    })

    it('loads a sky once, however many times the same state comes back', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(skyOf('sky-1'))

      expect(source.load).toHaveBeenCalledTimes(1)
    })

    it('frees the previous sky when another one is chosen', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      await applied(renderer, skyOf('sky-2'))

      expect(source.freed[0]).toHaveBeenCalled()
      expect(source.freed[1]).not.toHaveBeenCalled()
    })

    it('takes the background away when the picture goes', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(createSkyboxContent())

      expect(environment.setTexture).toHaveBeenCalledWith(null)
    })

    it('asks for nothing on a document that never had a picture', () => {
      mounted().apply(createSkyboxContent())

      expect(source.load).not.toHaveBeenCalled()
      expect(environment.setTexture).not.toHaveBeenCalled()
    })

    /**
     * The document may move on while a texture is in flight. Two things keep the loser out —
     * the engine's check on arrival, and the cache resolving to `null` once the last holder let
     * go — so this pins the behaviour, not either mechanism.
     */
    it('drops a texture that arrives after the document moved on', async () => {
      const renderer = mounted()
      let arrive: () => void = () => {}
      source.load.mockImplementationOnce(
        () => new Promise(resolve => (arrive = () => resolve(new Texture()))),
      )

      renderer.apply(skyOf('slow'))
      await applied(renderer, skyOf('quick'))
      arrive()
      // Drained, not merely awaited: the stale `then` runs on a later microtask, and asserting
      // before it does would pass whether the guard is there or not.
      await vi.advanceTimersByTimeAsync(0)

      expect(pipeline.renderTo).toHaveBeenCalledTimes(1)
    })

    it('grades nothing while the viewport has no pipeline', async () => {
      const renderer = unmountable()

      renderer.apply(skyOf('sky-1'))
      await vi.advanceTimersByTimeAsync(0)

      expect(source.load).toHaveBeenCalled()
      expect(pipeline.renderTo).not.toHaveBeenCalled()
    })
  })

  describe('the prefiltered map', () => {
    it('prefilters once for a burst of changes, not once per change', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(skyOf('sky-1'))
      renderer.apply(skyOf('sky-1'))
      renderer.apply(skyOf('sky-1'))
      expect(environment.refresh).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(120)

      expect(environment.refresh).toHaveBeenCalledTimes(1)
    })

    it('never prefilters after the engine is gone', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      renderer.apply(skyOf('sky-1'))

      renderer.dispose()
      await vi.advanceTimersByTimeAsync(500)

      expect(environment.refresh).not.toHaveBeenCalled()
    })
  })

  describe('the document speaking to the engine', () => {
    it('passes the environment settings through', () => {
      const content = createSkyboxContent()
      content.environment = { intensity: 0.25, showBackground: false }

      mounted().apply(content)

      expect(environment.setIntensity).toHaveBeenCalledWith(0.25)
      expect(environment.setBackgroundVisible).toHaveBeenCalledWith(false)
    })

    it('recolours the sun in place, keeping the instance three was given', () => {
      const renderer = mounted()
      // The scene is only reachable through the group the test-objects mock captured.
      const light = probes.group.parent?.children.find(child => child instanceof DirectionalLight)
      if (!light) throw new Error('the renderer never put its sun in the scene')
      const instance = light.color
      const content = createSkyboxContent()
      content.sun = { ...content.sun, color: '#ff8800' }

      renderer.apply(content)

      expect(light.color).toBe(instance)
      expect(light.color.getHexString()).toBe('ff8800')
    })
  })

  /**
   * A drag pushes one content object per frame, all four sections rebuilt. Measured before this
   * guard: two hundred frames of the sun's colour cost two hundred grading passes into the
   * 2048×1024 float target, plus two hundred of everything else the sun does not feed.
   */
  describe('the work a frame does not need', () => {
    const draggedSun = (frames: number): SkyboxContent[] =>
      Array.from({ length: frames }, (_unused, frame) => {
        const content = skyOf('sky-1')
        content.sun = { ...content.sun, color: `#ff00${frame.toString(16).padStart(2, '0')}` }
        return content
      })

    it('grades nothing more for a drag that only moves the sun', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      const gradedOnce = pipeline.renderTo.mock.calls.length

      for (const frame of draggedSun(200)) renderer.apply(frame)
      await vi.advanceTimersByTimeAsync(0)

      expect(pipeline.renderTo).toHaveBeenCalledTimes(gradedOnce)
      expect(adjust.setAdjustments).toHaveBeenCalledTimes(1)
      expect(environment.setIntensity).toHaveBeenCalledTimes(1)
      expect(environment.setBackgroundVisible).toHaveBeenCalledTimes(1)
    })

    it('still recolours the sun on every frame of that drag', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      const light = probes.group.parent?.children.find(child => child instanceof DirectionalLight)

      for (const frame of draggedSun(3)) renderer.apply(frame)

      expect(light?.color.getHexString()).toBe('ff0002')
    })

    it('grades again as soon as an adjustment moves', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      const content = skyOf('sky-1')
      content.adjustments = { ...content.adjustments, exposure: 1.7 }

      await applied(renderer, content)

      expect(adjust.setAdjustments).toHaveBeenLastCalledWith(content.adjustments)
    })

    it('brings the probes back when the sky arrives after the first frame', async () => {
      const renderer = mounted()
      renderer.apply(createSkyboxContent())
      expect(probes.group.visible).toBe(false)

      await applied(renderer, skyOf('sky-1'))

      expect(probes.group.visible).toBe(true)
    })

    it('takes the backdrop away when the document turns it off', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      const content = skyOf('sky-1')
      content.environment = { ...content.environment, showBackground: false }

      renderer.apply(content)

      expect(environment.setBackgroundVisible).toHaveBeenLastCalledWith(false)
    })

    it('follows the environment intensity on its own', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      const content = skyOf('sky-1')
      content.environment = { ...content.environment, intensity: 0.25 }

      renderer.apply(content)

      expect(environment.setIntensity).toHaveBeenLastCalledWith(0.25)
    })
  })

  describe('dragging inside the picture', () => {
    const grabbingTheSun = (button = 0): SkyboxRenderer => {
      const renderer = mounted()
      renderer.apply(sunAt(SUN_AHEAD))
      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10, button))
      return renderer
    }

    /**
     * The angles are the truth and the light follows them: a pointer raised above the horizon
     * has to report an elevation above it, whatever the light ended up at.
     */
    it('reports where the sun is dragged to, not where it was', () => {
      grabbingTheSun()

      ndc = { x: 0, y: 0.5 }
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).toHaveBeenCalledTimes(1)
      expect(onSunChange.mock.calls[0]?.[0].elevation).toBeGreaterThan(0)
    })

    it('turns the head when the drag starts away from the sun', () => {
      const renderer = mounted()
      renderer.apply(sunAt(SUN_BEHIND))
      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))
      const before = camera?.quaternion.clone()

      window.dispatchEvent(pointerAt('pointermove', 40, 10))

      expect(onSunChange).not.toHaveBeenCalled()
      expect(camera?.quaternion.equals(before ?? camera.quaternion)).toBe(false)
    })

    // Dragging right turns the view left: the image follows the hand, as grabbing the world
    // implies. Inverted, the viewport fights every gesture.
    it('turns the view the way the hand went, and keeps going from where it left off', () => {
      const renderer = mounted()
      renderer.apply(sunAt(SUN_BEHIND))
      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))

      window.dispatchEvent(pointerAt('pointermove', 110, 10))
      const afterFirst = camera?.rotation.y ?? 0
      window.dispatchEvent(pointerAt('pointermove', 210, 10))

      expect(afterFirst).toBeLessThan(0)
      // Read from the last point, not from where the drag began: measured from the start, the
      // second half of a drag would replay the first and the view would move twice as fast.
      expect(camera?.rotation.y).toBeCloseTo(afterFirst * 2, 5)
    })

    it('raises the view when the hand goes down', () => {
      const renderer = mounted()
      renderer.apply(sunAt(SUN_BEHIND))
      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))

      window.dispatchEvent(pointerAt('pointermove', 10, 110))

      expect(camera?.rotation.x).toBeGreaterThan(0)
    })

    it('ignores a drag begun with another button', () => {
      grabbingTheSun(2)

      ndc = { x: 0, y: 0.5 }
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    // A collapsed panel has no surface to hit: no gesture may begin on it, even if one could
    // continue by the time the pointer moves.
    it('ignores a drag begun on a canvas with no surface', () => {
      const renderer = mounted()
      renderer.apply(sunAt(SUN_AHEAD))
      ndc = null

      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))
      ndc = { x: 0, y: 0.5 }
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    it('reports nothing while the pointer has no surface under it', () => {
      grabbingTheSun()

      ndc = null
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    it('does nothing on a move with no drag under way', () => {
      mounted()

      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    it('lets the sun go when the pointer is released', () => {
      grabbingTheSun()

      window.dispatchEvent(pointerAt('pointerup', 10, 10))
      ndc = { x: 0, y: 0.5 }
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    it('stops listening to the window once it is gone', () => {
      const renderer = grabbingTheSun()

      renderer.dispose()
      mountedRenderers.length = 0
      ndc = { x: 0, y: 0.5 }
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })
  })

  describe('going away', () => {
    // `probes` stays out: covering it would mean a fourth double for three meshes that own
    // nothing else. `test-objects.ts` has no test at all — that is its own lot.
    it('frees its sky, its target, its passes and its viewport', async () => {
      const renderer = mounted()
      const target = vi.spyOn(gradedTarget() ?? new WebGLRenderTarget(1, 1), 'dispose')
      await applied(renderer, skyOf('sky-1'))

      renderer.dispose()

      expect(source.freed[0]).toHaveBeenCalled()
      expect(target).toHaveBeenCalled()
      expect(environment.dispose).toHaveBeenCalled()
      expect(pipeline.dispose).toHaveBeenCalled()
      expect(adjust.dispose).toHaveBeenCalled()
      expect(disposeViewport).toHaveBeenCalled()
    })

    it('disposes cleanly when the mount never got a renderer', () => {
      const renderer = unmountable()

      expect(() => renderer.dispose()).not.toThrow()
      expect(pipeline.dispose).not.toHaveBeenCalled()
    })
  })
})

/**
 * The empty state is the one sentence telling anyone what to do in this space, and it is drawn
 * over the viewport. Seen on screen on 9 August: a `text-muted` over a lit ground and three
 * spheres does not read — and there is nothing to judge without a sky anyway.
 */
describe('the test objects of a skybox', () => {
  const mountedRenderers: SkyboxRenderer[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.spyOn(ViewportEngine.prototype, 'mount').mockImplementation(() => {})
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue({} as never)
    vi.spyOn(ViewportEngine.prototype, 'canvas', 'get').mockReturnValue(
      document.createElement('canvas'),
    )
  })

  afterEach(() => {
    for (const renderer of mountedRenderers.splice(0)) renderer.dispose()
    vi.useRealTimers()
  })

  const mounted = (): SkyboxRenderer => {
    const renderer = new SkyboxRenderer({
      onSunChange: vi.fn(),
      loadTexture: fakeTextureSource().load,
    })
    renderer.mount(document.createElement('div'))
    mountedRenderers.push(renderer)
    return renderer
  }

  const withSky = (): SkyboxContent => {
    const content = createSkyboxContent()
    content.source = { assetId: 'sky-1' }
    return content
  }

  it('shows nothing to judge until a sky is placed', () => {
    mounted().apply(createSkyboxContent())

    expect(probes.group.visible).toBe(false)
  })

  it('shows them once a sky is placed', () => {
    mounted().apply(withSky())

    expect(probes.group.visible).toBe(true)
  })

  /** The setting still wins: asked to hide them, they stay hidden with a sky in place. */
  it('keeps them hidden when the setting says so', () => {
    const renderer = mounted()

    renderer.setProbesVisible(false)
    renderer.apply(withSky())

    expect(probes.group.visible).toBe(false)
  })

  /** And they go again when the sky is taken away — the empty state comes back with them. */
  it('hides them again when the sky is removed', () => {
    const renderer = mounted()
    renderer.apply(withSky())

    renderer.apply(createSkyboxContent())

    expect(probes.group.visible).toBe(false)
  })
})

/**
 * A flat view is a quad over the frame, so what sits behind it is worth nothing — and worse
 * than nothing for the backdrop: the projection letterboxes its picture, and the immersive sky
 * showing through the bars would read as part of what is being judged.
 */
describe('the views of a skybox', () => {
  const mountedRenderers: SkyboxRenderer[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.spyOn(ViewportEngine.prototype, 'mount').mockImplementation(() => {})
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue({} as never)
    vi.spyOn(ViewportEngine.prototype, 'canvas', 'get').mockReturnValue(
      document.createElement('canvas'),
    )
  })

  afterEach(() => {
    for (const renderer of mountedRenderers.splice(0)) renderer.dispose()
    vi.useRealTimers()
  })

  const withSky = (): SkyboxContent => {
    const content = createSkyboxContent()
    content.source = { assetId: 'sky-1' }
    return content
  }

  const mounted = (): SkyboxRenderer => {
    const renderer = new SkyboxRenderer({
      onSunChange: vi.fn(),
      loadTexture: fakeTextureSource().load,
    })
    renderer.mount(document.createElement('div'))
    mountedRenderers.push(renderer)
    renderer.apply(withSky())
    return renderer
  }

  it('drops the backdrop and the probes for a flat view', () => {
    const renderer = mounted()

    renderer.setView('cross')

    expect(environment.setBackgroundVisible).toHaveBeenLastCalledWith(false)
    expect(probes.group.visible).toBe(false)
  })

  it('gives them back on the way home', () => {
    const renderer = mounted()

    renderer.setView('faces')
    renderer.setView('immersive')

    expect(environment.setBackgroundVisible).toHaveBeenLastCalledWith(true)
    expect(probes.group.visible).toBe(true)
  })

  /** What the document asked of the backdrop is not forgotten while a flat view is on. */
  it('does not turn a backdrop back on that the document had turned off', () => {
    const renderer = mounted()
    const content = withSky()
    content.environment = { ...content.environment, showBackground: false }
    renderer.apply(content)

    renderer.setView('equirect')
    renderer.setView('immersive')

    expect(environment.setBackgroundVisible).toHaveBeenLastCalledWith(false)
  })

  /** Nothing is drawn over the immersive view — it IS the scene. */
  it('draws no projection in the immersive view', () => {
    mounted()

    expect(pipeline.renderToScreen).not.toHaveBeenCalled()
  })
})
