import { ACESFilmicToneMapping, NoToneMapping } from 'three'
import type * as ThreeModule from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ViewportEngine } from './ViewportEngine'

/**
 * A renderer jsdom can hold: the real one asks the canvas for a WebGL context and gets null.
 * Only what the engine reads back is kept — the element it draws into, the two flags it sets at
 * mount, `autoClear`, which the overlay pass turns off and back on, and `info`.
 *
 * `info` follows three.js 0.185.1 to the letter, because the counting depends on it: `render`
 * clears the counters first when `autoReset` is on, then adds one draw call. A viewport with an
 * overlay calls `render` twice, so a stand-in that skipped the clearing would report a passing
 * count for a viewport that measures only its trihedron.
 */
const disposed = vi.fn()
const sized = vi.fn()
const pixelRatio = vi.fn()
const rendered = vi.fn()

vi.mock('three', async importOriginal => ({
  ...(await importOriginal<typeof ThreeModule>()),
  WebGLRenderer: class {
    readonly domElement: HTMLCanvasElement
    readonly shadowMap = { enabled: false }
    toneMapping = NoToneMapping
    autoClear = true
    readonly info = {
      autoReset: true,
      render: { calls: 0, triangles: 0, points: 0, lines: 0 },
      memory: { geometries: 0, textures: 0 },
      reset: (): void => {
        this.info.render.calls = 0
        this.info.render.triangles = 0
        this.info.render.points = 0
        this.info.render.lines = 0
      },
    }

    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      this.domElement = canvas
    }

    setPixelRatio = pixelRatio
    setSize = sized
    dispose = disposed
    render = (...args: unknown[]): void => {
      if (this.info.autoReset) this.info.reset()
      this.info.render.calls += 1
      rendered(...args)
    }
  },
}))

/** What `test-setup` pins `clientWidth`/`clientHeight` to, since jsdom runs no layout. */
const HOST_WIDTH = 640
const HOST_HEIGHT = 800

describe('a viewport', () => {
  let host: HTMLElement
  let frames: Map<number, FrameRequestCallback>
  let nextHandle: number
  let engines: ViewportEngine[]

  beforeEach(() => {
    vi.clearAllMocks()
    host = document.createElement('div')
    document.body.appendChild(host)
    engines = []

    // Frames are run by hand: a viewport that only draws on demand is unobservable otherwise,
    // and a real `requestAnimationFrame` never fires under a test runner.
    frames = new Map()
    nextHandle = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(nextHandle, callback)
      return nextHandle++
    })
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle))
  })

  afterEach(() => {
    for (const engine of engines) engine.dispose()
    vi.unstubAllGlobals()
    host.remove()
  })

  const mounted = (options?: ConstructorParameters<typeof ViewportEngine>[0]): ViewportEngine => {
    const engine = new ViewportEngine(options)
    engine.mount(host)
    engines.push(engine)
    return engine
  }

  /** Mounted and its first frame drawn, so the engine holds no pending frame handle. */
  const atRest = (options?: ConstructorParameters<typeof ViewportEngine>[0]): ViewportEngine => {
    const engine = mounted(options)
    drawFrames()
    return engine
  }

  const drawFrames = (): void => {
    const pending = [...frames.values()]
    frames.clear()
    for (const frame of pending) frame(performance.now())
  }

  describe('mounting', () => {
    /** React must never own the canvas — see the engine invariants in CLAUDE.md. */
    it('makes its own canvas inside the host', () => {
      mounted()

      expect(host.querySelector('canvas')).not.toBeNull()
    })

    it('draws flat by default, and filmic when asked', () => {
      expect(mounted().gl?.toneMapping).toBe(NoToneMapping)
      expect(mounted({ toneMapping: true }).gl?.toneMapping).toBe(ACESFilmicToneMapping)
    })

    it('leaves shadow maps off unless a viewport asks for them', () => {
      expect(mounted().gl?.shadowMap.enabled).toBe(false)
      expect(mounted({ shadows: true }).gl?.shadowMap.enabled).toBe(true)
    })

    it('gives no orbit to a viewport that only looks around', () => {
      expect(mounted({ controls: 'none' }).orbit).toBeNull()
    })

    it('orbits by default', () => {
      expect(mounted().orbit).not.toBeNull()
    })

    it('sizes itself and its camera to the host', () => {
      const engine = mounted()

      expect(sized).toHaveBeenCalledWith(HOST_WIDTH, HOST_HEIGHT, false)
      expect(engine.perspective.aspect).toBe(HOST_WIDTH / HOST_HEIGHT)
    })
  })

  describe('before it is mounted', () => {
    it('has no canvas, no renderer and no orbit', () => {
      const engine = new ViewportEngine()

      expect(engine.canvas).toBeNull()
      expect(engine.gl).toBeNull()
      expect(engine.orbit).toBeNull()
    })

    /** A panel that is still laying out has no surface: no ray may be cast through it. */
    it('places no pointer and reads no palette token', () => {
      const engine = new ViewportEngine()

      expect(engine.pointerNdcOf({ clientX: 10, clientY: 10 })).toBeNull()
      expect(engine.paletteToken('panel')).toBe('')
    })

    it('asks for no frame', () => {
      new ViewportEngine().requestRender()

      expect(frames.size).toBe(0)
    })
  })

  describe('the frame loop', () => {
    it('asks for one frame however many times it is nudged', () => {
      const engine = atRest({ controls: 'none' })

      engine.requestRender()
      engine.requestRender()
      engine.requestRender()

      expect(frames.size).toBe(1)
    })

    /** A studio whose viewport burns a frame at rest heats the machine for nothing. */
    it('goes back to sleep once nothing moves', () => {
      mounted({ controls: 'none', onFrame: () => false })

      drawFrames()

      expect(rendered).toHaveBeenCalled()
      expect(frames.size).toBe(0)
    })

    it('keeps drawing while something is still moving', () => {
      mounted({ controls: 'none', onFrame: () => true })

      drawFrames()

      expect(frames.size).toBe(1)
    })

    /**
     * The gap a resting viewport leaves is however long the user was away, not a frame. Left on
     * the clock, the next run of the loop opens on a `MAX_DELTA` jump — and every caller that
     * starts an animation would have to remember `resetClock` to avoid it.
     */
    it('opens a new run of the loop from rest, not on the time it spent asleep', () => {
      const onFrame = vi.fn(() => false)
      const clock = vi.spyOn(performance, 'now').mockReturnValue(1_000)
      const engine = atRest({ controls: 'none', onFrame })

      // Five seconds away, then something asks for a frame again.
      clock.mockReturnValue(6_000)
      engine.requestRender()
      drawFrames()

      expect(onFrame).toHaveBeenLastCalledWith(0)
      clock.mockRestore()
    })

    it('draws the overlay without clearing what is under it', () => {
      let clearedDuringOverlay = true
      const engine = mounted({
        controls: 'none',
        onOverlay: renderer => (clearedDuringOverlay = renderer.autoClear),
      })

      drawFrames()

      expect(clearedDuringOverlay).toBe(false)
      expect(engine.gl?.autoClear).toBe(true)
    })

    /** Otherwise every later frame smears over the last one, for good. */
    it('puts clearing back even when the overlay throws', () => {
      const engine = mounted({
        controls: 'none',
        onOverlay: () => {
          throw new Error('overlay')
        },
      })

      expect(() => drawFrames()).toThrow('overlay')
      expect(engine.gl?.autoClear).toBe(true)
    })
  })

  describe('the gpu counters', () => {
    it('reports nothing until a frame has actually been drawn', () => {
      expect(mounted({ controls: 'none' }).stats).toMatchObject({ calls: 0, frames: 0 })
    })

    it('counts the overlay pass into the frame instead of being reset by it', () => {
      const engine = mounted({
        controls: 'none',
        onOverlay: renderer => renderer.render(engine.scene, engine.camera),
      })

      drawFrames()

      expect(rendered).toHaveBeenCalledTimes(2)
      expect(engine.stats.calls).toBe(2)
    })

    /**
     * Turning `autoReset` off hands the clearing to the engine: skip it and the counters add up
     * across frames, so a viewport left orbiting would report a cost that only ever climbs.
     */
    it('reports one frame at a time rather than the sum of every frame drawn', () => {
      const engine = mounted({ controls: 'none', onFrame: () => true })
      const first = engine.stats

      drawFrames()
      drawFrames()
      drawFrames()

      expect(engine.stats).toMatchObject({ frames: 3, calls: 1 })
      expect(engine.stats).toBe(first)
    })

    /** What proves a viewport went back to sleep rather than burning frames unseen. */
    it('stops counting once nothing moves', () => {
      const engine = mounted({ controls: 'none', onFrame: () => false })

      drawFrames()
      drawFrames()

      expect(engine.stats.frames).toBe(1)
    })
  })

  describe('the field of view', () => {
    it('takes the new angle and redraws', () => {
      const engine = atRest({ controls: 'none' })

      engine.setFieldOfView(90)

      expect(engine.perspective.fov).toBe(90)
      expect(frames.size).toBe(1)
    })

    it('redraws nothing when the angle does not change', () => {
      const engine = atRest({ fieldOfView: 60, controls: 'none' })

      engine.setFieldOfView(60)

      expect(frames.size).toBe(0)
    })
  })

  it('takes a background colour, and gives it back when asked for none', () => {
    const engine = mounted()

    engine.setBackgroundColor('#191a1c')
    expect(engine.scene.background).not.toBeNull()

    engine.setBackgroundColor('')
    expect(engine.scene.background).toBeNull()
  })

  describe('going away', () => {
    /**
     * Left behind, the next mount stacks a second canvas on top of it and the host grows a dead
     * one per remount.
     */
    it('takes its canvas with it', () => {
      const engine = mounted()

      engine.dispose()

      expect(host.querySelector('canvas')).toBeNull()
      expect(disposed).toHaveBeenCalled()
    })

    it('drops the frame it had asked for', () => {
      const engine = atRest({ controls: 'none' })
      rendered.mockClear()
      engine.requestRender()

      engine.dispose()

      // Cancelled, not merely made harmless: a callback left queued keeps the whole engine
      // alive until it runs, and `renderFrame` bailing out would hide that.
      expect(frames.size).toBe(0)
      drawFrames()
      expect(rendered).not.toHaveBeenCalled()
    })

    it('disposes cleanly when it was never mounted', () => {
      expect(() => new ViewportEngine().dispose()).not.toThrow()
    })
  })
})
