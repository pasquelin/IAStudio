import { Texture, WebGLRenderTarget } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import type { GpuPipeline } from '../gpu/GpuPipeline'
import type { ViewportEnvironment } from '../viewport/environment'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { SkyboxRenderer } from './SkyboxRenderer'
import type { SkyboxGesture } from './sun-drag'

/**
 * Two collaborators need a GL context jsdom cannot give: the environment prefilters a mip
 * chain, and the pipeline draws a full-screen quad into a target. Both are stubbed at their
 * own boundary — `satisfies` so that a member added to either port fails to compile here
 * rather than at run time on an opaque "is not a function".
 */
const environment = {
  setTexture: vi.fn(),
  refresh: vi.fn(),
  setStudio: vi.fn(),
  setIntensity: vi.fn(),
  setRotation: vi.fn(),
  setBackgroundVisible: vi.fn(),
  dispose: vi.fn(),
} satisfies ViewportEnvironment

const pipeline = {
  renderTo: vi.fn(),
  renderToScreen: vi.fn(),
  createTarget: vi.fn(() => new WebGLRenderTarget(4, 2)),
  dispose: vi.fn(),
} satisfies GpuPipeline

vi.mock('../viewport/environment', () => ({ createEnvironment: () => environment }))
vi.mock('../gpu/GpuPipeline', () => ({ createGpuPipeline: () => pipeline }))

/**
 * Which gesture a drag is, decided by the test rather than by geometry. `gestureFor` compares
 * the ray against the sun, and a raycast here would read a camera whose world matrix no frame
 * has ever updated — the engine's job is the wiring, and the geometry has `sun-drag.test.ts`.
 */
let gesture: SkyboxGesture = 'sun'

vi.mock('./sun-drag', () => ({ gestureFor: () => gesture }))

const skyOf = (assetId: string): SkyboxContent => {
  const content = createSkyboxContent()
  content.source = { assetId }
  return content
}

describe('the renderer of a skybox', () => {
  let onSunChange: Mock<(angles: { elevation: number; azimuth: number }) => void>
  let loadTexture: Mock<(url: string) => Promise<Texture>>
  let freed: ReturnType<typeof vi.spyOn>[]
  let host: HTMLElement
  let canvas: HTMLCanvasElement
  let ndc: { x: number; y: number } | null

  beforeEach(() => {
    vi.clearAllMocks()
    // Fake from the start: the prefilter is scheduled on a real timer otherwise, and one left
    // pending by a test fires inside the next and refreshes an environment nobody asked.
    vi.useFakeTimers()
    gesture = 'sun'
    freed = []
    onSunChange = vi.fn()
    loadTexture = vi.fn(async () => {
      const texture = new Texture()
      freed.push(vi.spyOn(texture, 'dispose'))
      return texture
    })

    canvas = document.createElement('canvas')
    host = document.createElement('div')
    // A pointer with a surface under it. `null` is the other case — a collapsed panel — and the
    // tests that want it say so.
    ndc = { x: 0, y: 0 }

    vi.spyOn(ViewportEngine.prototype, 'mount').mockImplementation(() => {})
    // `as`: neither the pipeline nor the environment is real here, and nothing else reads it.
    vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue({} as never)
    vi.spyOn(ViewportEngine.prototype, 'canvas', 'get').mockReturnValue(canvas)
    // jsdom runs no layout, so the real one measures a zero-sized canvas and answers null for
    // every pointer — which would leave every gesture untested.
    vi.spyOn(ViewportEngine.prototype, 'pointerNdcOf').mockImplementation(() => ndc)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mounted = (): SkyboxRenderer => {
    const renderer = new SkyboxRenderer({ onSunChange, loadTexture })
    renderer.mount(host)
    return renderer
  }

  /**
   * Waits for the grading pass, not for the load: `apply` returns before the texture arrives,
   * and a test that only waits for the request runs while the engine still holds no picture.
   */
  const applied = async (renderer: SkyboxRenderer, content: SkyboxContent): Promise<void> => {
    const graded = pipeline.renderTo.mock.calls.length
    renderer.apply(content)
    await vi.waitFor(() => expect(pipeline.renderTo).toHaveBeenCalledTimes(graded + 1))
  }

  /** A document whose sun sits on the horizon, where a ray through the centre of the frame goes. */
  const sunAtEyeLevel = (): SkyboxContent => {
    const content = createSkyboxContent()
    content.sun = { ...content.sun, elevation: 0, azimuth: 0 }
    return content
  }

  const pointerAt = (type: string, x: number, y: number, button = 0): PointerEvent =>
    // `as`: jsdom ships no `PointerEvent`, and a gesture only reads the button and the point.
    new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true }) as PointerEvent

  describe('mounting', () => {
    it('builds nothing when the viewport has no renderer to share', () => {
      vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue(null)

      new SkyboxRenderer({ onSunChange, loadTexture }).mount(host)

      expect(pipeline.createTarget).not.toHaveBeenCalled()
    })

    /**
     * Half float, not bytes: this target is what the prefiltered map is built from, and eight
     * bits per channel bands on a sky gradient long before it does on a texture.
     */
    it('grades into a half-float target', () => {
      mounted()

      expect(pipeline.createTarget).toHaveBeenCalledWith(2048, 1024, 'float')
    })
  })

  describe('the source picture', () => {
    it('asks for the sky by asset id, not by a URL it built itself', async () => {
      await applied(mounted(), skyOf('sky-1'))

      expect(loadTexture).toHaveBeenCalledWith('scenario://asset/sky-1')
    })

    it('loads a sky once, however many times the same state comes back', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(skyOf('sky-1'))

      expect(loadTexture).toHaveBeenCalledTimes(1)
    })

    it('frees the previous sky when another one is chosen', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      await applied(renderer, skyOf('sky-2'))

      await vi.waitFor(() => expect(freed[0]).toHaveBeenCalled())
      expect(freed[1]).not.toHaveBeenCalled()
    })

    /** A document that had a picture and lost it must not keep showing the old one. */
    it('takes the background away when the picture goes', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(createSkyboxContent())

      expect(environment.setTexture).toHaveBeenCalledWith(null)
    })

    /** Nothing to ask for, and nothing to erase: a new document leaves the environment alone. */
    it('asks for nothing on a document that never had a picture', () => {
      mounted().apply(createSkyboxContent())

      expect(loadTexture).not.toHaveBeenCalled()
      expect(environment.setTexture).not.toHaveBeenCalled()
    })

    /**
     * The document may move on while a texture is in flight. Two things keep the loser out —
     * the engine's check on arrival, and the cache resolving to `null` once the last holder
     * let go — so this pins the behaviour, not either mechanism.
     */
    it('drops a texture that arrives after the document moved on', async () => {
      const renderer = mounted()
      let arrive: (texture: Texture) => void = () => {}
      loadTexture.mockImplementationOnce(() => new Promise<Texture>(resolve => (arrive = resolve)))

      renderer.apply(skyOf('slow'))
      await applied(renderer, skyOf('quick'))

      arrive(new Texture())
      // Drained, not merely awaited: the stale `then` runs on a later microtask, and asserting
      // before it does would pass whether the guard is there or not.
      await vi.advanceTimersByTimeAsync(0)

      // Still one: the picture that lost the race must not grade itself over the winner.
      expect(pipeline.renderTo).toHaveBeenCalledTimes(1)
    })

    it('grades the picture into the background once it arrives', async () => {
      await applied(mounted(), skyOf('sky-1'))

      await vi.waitFor(() => expect(pipeline.renderTo).toHaveBeenCalled())
      expect(environment.setTexture).toHaveBeenCalled()
    })

    it('grades nothing while the viewport has no pipeline', () => {
      vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue(null)
      const renderer = new SkyboxRenderer({ onSunChange, loadTexture })
      renderer.mount(host)

      renderer.apply(skyOf('sky-1'))

      expect(pipeline.renderTo).not.toHaveBeenCalled()
    })
  })

  describe('the prefiltered map', () => {
    /**
     * Prefiltering is a full mip chain. Run per frame of a slider drag it drops the viewport to
     * single digits, which is why the refresh is rescheduled rather than queued.
     */
    it('prefilters once for a burst of changes, not once per change', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.apply(skyOf('sky-1'))
      renderer.apply(skyOf('sky-1'))
      renderer.apply(skyOf('sky-1'))
      expect(environment.refresh).not.toHaveBeenCalled()
      vi.advanceTimersByTime(120)

      expect(environment.refresh).toHaveBeenCalledTimes(1)
    })

    it('never prefilters after the engine is gone', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))
      renderer.apply(skyOf('sky-1'))

      renderer.dispose()
      vi.advanceTimersByTime(500)

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

    it('delegates the field of view to the viewport', () => {
      const setFieldOfView = vi.spyOn(ViewportEngine.prototype, 'setFieldOfView')

      mounted().setFieldOfView(75)

      expect(setFieldOfView).toHaveBeenCalledWith(75)
    })

    it('shows and hides the probes and the ground', () => {
      const renderer = mounted()

      renderer.setProbesVisible(false)
      renderer.setGroundVisible(false)
      renderer.setProbesVisible(true)

      // Nothing to assert on beyond not throwing: the objects are three's, and what matters is
      // that the calls reach them rather than a null field left by a failed mount.
      expect(() => renderer.dispose()).not.toThrow()
    })
  })

  describe('dragging inside the picture', () => {
    const grabbingTheSun = (): SkyboxRenderer => {
      const renderer = mounted()
      renderer.apply(sunAtEyeLevel())
      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))
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

    /** Off the sun, the same drag turns the head — and must never report a sun angle. */
    it('turns the head when the drag starts away from the sun', () => {
      gesture = 'look'
      const renderer = mounted()
      renderer.apply(sunAtEyeLevel())

      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))
      window.dispatchEvent(pointerAt('pointermove', 40, 10))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    it('ignores a drag begun with another button', () => {
      const renderer = mounted()
      renderer.apply(sunAtEyeLevel())

      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10, 2))
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    /** A collapsed panel has no surface to hit: no gesture may begin on it. */
    it('ignores a drag begun on a canvas with no surface', () => {
      const renderer = mounted()
      renderer.apply(sunAtEyeLevel())
      ndc = null

      canvas.dispatchEvent(pointerAt('pointerdown', 10, 10))
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    /** The sun is grabbed, then the pointer leaves the surface mid-drag. */
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
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })

    it('stops listening to the window once it is gone', () => {
      const renderer = grabbingTheSun()

      renderer.dispose()
      ndc = { x: 0, y: 0.5 }
      window.dispatchEvent(pointerAt('pointermove', 20, 30))

      expect(onSunChange).not.toHaveBeenCalled()
    })
  })

  describe('going away', () => {
    it('frees its sky, its target and everything it built', async () => {
      const renderer = mounted()
      await applied(renderer, skyOf('sky-1'))

      renderer.dispose()

      expect(freed[0]).toHaveBeenCalled()
      expect(environment.dispose).toHaveBeenCalled()
      expect(pipeline.dispose).toHaveBeenCalled()
    })

    it('disposes cleanly when the mount never got a renderer', () => {
      vi.spyOn(ViewportEngine.prototype, 'gl', 'get').mockReturnValue(null)
      const renderer = new SkyboxRenderer({ onSunChange, loadTexture })
      renderer.mount(host)

      expect(() => renderer.dispose()).not.toThrow()
      expect(pipeline.dispose).not.toHaveBeenCalled()
    })
  })
})
