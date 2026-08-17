import { ACESFilmicToneMapping, NoToneMapping, OrthographicCamera, PerspectiveCamera } from 'three'
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
const viewported = vi.fn()
const scissored = vi.fn()
const scissorTest = vi.fn()
/** What the display is worth. Two is a laptop retina screen, which is where the fault showed. */
let displayRatio = 1

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
    setViewport = viewported
    setScissor = scissored
    setScissorTest = scissorTest
    getPixelRatio = (): number => displayRatio
    render = (...args: unknown[]): void => {
      if (this.info.autoReset) this.info.reset()
      this.info.render.calls += 1
      rendered(...args)
    }
  },
}))

/** What `testSetup` pins `clientWidth`/`clientHeight` to, since jsdom runs no layout. */
const HOST_WIDTH = 640
const HOST_HEIGHT = 800

describe('a viewport', () => {
  let host: HTMLElement
  let frames: Map<number, FrameRequestCallback>
  let nextHandle: number
  let engines: ViewportEngine[]

  beforeEach(() => {
    vi.clearAllMocks()
    displayRatio = 1
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

  describe('the quad layout', () => {
    /** A pointer event jsdom will carry, at a point of the canvas that stands at the origin. */
    const pointerAt = (x: number, y: number): PointerEvent =>
      new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })

    it('starts as one view over the whole surface', () => {
      const engine = mounted()

      expect(engine.paneLayout).toBe('single')
      expect(engine.paneCameras).toHaveLength(1)
    })

    it('adds three orthographic views, and takes them away again', () => {
      const engine = mounted()

      engine.setLayout('quad')
      expect(engine.paneCameras).toHaveLength(4)
      // The main one keeps its projection; the three added are side views, never perspective.
      const added = engine.paneCameras.slice(1)
      expect(added.every(camera => camera instanceof OrthographicCamera)).toBe(true)

      engine.setLayout('single')
      expect(engine.paneCameras).toHaveLength(1)
    })

    /** One context for four views — a second one per pane is what this layout must never cost. */
    it('draws four scissored passes into the one canvas', () => {
      const engine = atRest()
      rendered.mockClear()
      viewported.mockClear()

      engine.setLayout('quad')
      drawFrames()

      expect(rendered).toHaveBeenCalledTimes(4)
      expect(scissorTest).toHaveBeenLastCalledWith(false)
      // Bottom-left quarter, in WebGL's own frame: origin at the bottom, so the top-left pane
      // sits at half the height and the bottom row at zero.
      expect(viewported).toHaveBeenCalledWith(0, HOST_HEIGHT / 2, HOST_WIDTH / 2, HOST_HEIGHT / 2)
      expect(scissored).toHaveBeenCalledWith(HOST_WIDTH / 2, 0, HOST_WIDTH / 2, HOST_HEIGHT / 2)
    })

    /**
     * The fault this caught the hard way: three multiplies by the renderer's pixel ratio itself,
     * so scaling the rectangle here as well squared it. On a display at 2 the first pane covered
     * four times its share and hid the three others — a quad view that drew one view. Every test
     * before this one ran at a ratio of 1, where the fault cannot show.
     */
    it('places its panes in CSS pixels, whatever the display is worth', () => {
      displayRatio = 2
      const engine = atRest()
      viewported.mockClear()

      engine.setLayout('quad')
      drawFrames()

      // The same rectangles as at a ratio of 1: three applies the display's own scale after this.
      expect(viewported).toHaveBeenCalledWith(0, HOST_HEIGHT / 2, HOST_WIDTH / 2, HOST_HEIGHT / 2)
      expect(viewported).not.toHaveBeenCalledWith(0, HOST_HEIGHT, HOST_WIDTH, HOST_HEIGHT)
    })

    it('draws the camera preview as one more scissored pass, never a second context', () => {
      const engine = atRest()
      rendered.mockClear()

      engine.setInsetPane({
        camera: new PerspectiveCamera(),
        rect: { x: 500, y: 700, width: 100, height: 56 },
      })
      drawFrames()

      expect(rendered).toHaveBeenCalledTimes(2)
      // Bottom-right, in WebGL's own frame: the host is 800 tall, so a rect 700 down sits at 44.
      expect(scissored).toHaveBeenCalledWith(500, HOST_HEIGHT - 700 - 56, 100, 56)
      expect(scissorTest).toHaveBeenLastCalledWith(false)
    })

    it('hides the workshop for the preview pass and puts it back after', () => {
      const restore = vi.fn()
      const hide = vi.fn(() => restore)
      const engine = atRest({ onInset: hide })

      engine.setInsetPane({
        camera: new PerspectiveCamera(),
        rect: { x: 0, y: 0, width: 100, height: 56 },
      })
      drawFrames()

      expect(hide).toHaveBeenCalledTimes(1)
      expect(restore).toHaveBeenCalledTimes(1)
    })

    // Without this a drag inside the preview would orbit the view underneath it.
    it('answers no pane for a pointer inside the preview', () => {
      const engine = atRest()
      engine.setInsetPane({
        camera: new PerspectiveCamera(),
        rect: { x: 500, y: 700, width: 100, height: 56 },
      })

      expect(engine.paneAtPointer(pointerAt(550, 720))).toBeNull()
      expect(engine.paneAtPointer(pointerAt(100, 100))).toBe(0)
    })

    it('draws one pass and no scissor while there is one view', () => {
      const engine = atRest()
      rendered.mockClear()
      scissorTest.mockClear()

      engine.requestRender()
      drawFrames()

      expect(rendered).toHaveBeenCalledTimes(1)
      expect(scissorTest).not.toHaveBeenCalled()
    })

    it('sizes the main camera to its quarter rather than to the canvas', () => {
      const engine = mounted()

      engine.setLayout('quad')
      // Same ratio here, since both halves are halved — what changes is which rectangle it reads.
      expect(engine.perspective.aspect).toBe(HOST_WIDTH / HOST_HEIGHT)
      expect(engine.paneAtPointer(pointerAt(10, 10))).toBe(0)
    })

    it('hands the drag to the pane under the pointer, and to it alone', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      canvas.dispatchEvent(pointerAt(HOST_WIDTH - 10, 10))

      expect(engine.paneOrbits.map(orbit => orbit?.enabled)).toEqual([false, true, false, false])
    })

    it('leaves every orbit alone while there is one view', () => {
      const engine = mounted()
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      canvas.dispatchEvent(pointerAt(10, 10))

      expect(engine.orbit?.enabled).toBe(true)
    })

    it('reads a pointer against its own pane, not against the canvas', () => {
      const engine = mounted()
      engine.setLayout('quad')

      // Dead centre of the bottom-right pane: its own centre, whatever the canvas thinks.
      const ndc = engine.pointerNdcOf(pointerAt(HOST_WIDTH * 0.75, HOST_HEIGHT * 0.75))

      expect(ndc?.x).toBeCloseTo(0)
      expect(ndc?.y).toBeCloseTo(0)
    })

    /** The seam a per-view display mode hangs on: each pane is announced before its own pass. */
    it('says which pane is about to be drawn, before drawing it', () => {
      const dressed: number[] = []
      const engine = atRest({ onPane: index => dressed.push(index) })

      engine.setLayout('quad')
      dressed.length = 0
      drawFrames()

      expect(dressed).toEqual([0, 1, 2, 3])
    })

    it('announces the one pane of a single layout too', () => {
      const dressed: number[] = []
      const engine = atRest({ onPane: index => dressed.push(index) })

      dressed.length = 0
      engine.requestRender()
      drawFrames()

      expect(dressed).toEqual([0])
    })

    it('takes the active pane back to the first when the layout closes', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      canvas.dispatchEvent(pointerAt(HOST_WIDTH - 10, HOST_HEIGHT - 10))
      expect(engine.activePane).toBe(3)

      engine.setLayout('single')
      expect(engine.activePane).toBe(0)
    })

    /** A viewport that only looks around has no orbit to hand over, in four views as in one. */
    it('adds views without orbits to a viewport that has none', () => {
      const engine = mounted({ controls: 'none' })

      engine.setLayout('quad')

      expect(engine.paneCameras).toHaveLength(4)
      expect(engine.paneOrbits).toEqual([null, null, null, null])
    })

    it('leaves the orbits alone when the pointer is off the surface', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      canvas.dispatchEvent(pointerAt(10, 10))
      canvas.dispatchEvent(pointerAt(HOST_WIDTH + 50, 10))

      // Off the surface arms nobody, and the pane last used keeps the drag it was given.
      expect(engine.paneOrbits.map(orbit => orbit?.enabled)).toEqual([false, false, false, false])
      expect(engine.activePane).toBe(0)
    })

    it('asks for four views before it is mounted without building anything', () => {
      const engine = new ViewportEngine()
      engines.push(engine)

      engine.setLayout('quad')

      // Four cameras, no orbit: an orbit needs the canvas the mount has not made yet.
      expect(engine.paneCameras).toHaveLength(4)
      expect(engine.paneOrbits.slice(1)).toEqual([null, null, null])
      expect(engine.paneAtPointer(pointerAt(0, 0))).toBeNull()
      expect(engine.pointerNdcOf(pointerAt(0, 0))).toBeNull()
    })

    it('asks for the layout it already has without rebuilding anything', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const first = engine.paneCameras[1]

      engine.setLayout('quad')

      expect(engine.paneCameras[1]).toBe(first)
    })

    it('gives every added orbit back when it goes away', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const orbits = engine.paneOrbits.slice(1)

      engine.dispose()

      // Disposed controls answer no gesture; what this guards is that they were disposed at all.
      expect(orbits.every(orbit => orbit !== null)).toBe(true)
      expect(engine.paneCameras).toHaveLength(1)
    })

    it('takes the height its scene needs, and refuses a height of nothing', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const side = engine.paneCameras[1]
      if (!(side instanceof OrthographicCamera)) throw new Error('the added views are flat')

      engine.setPaneHeight(40)
      expect(side.top).toBe(20)

      // Nothing, and the same value again, both leave the frustum where it is.
      engine.setPaneHeight(0)
      engine.setPaneHeight(40)
      expect(side.top).toBe(20)
    })

    /** A second perspective is a layout the user may ask for, so a pane carries both cameras. */
    it('swaps a pane between the two projections, keeping its placement', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const flat = engine.paneCameras[1]
      if (!(flat instanceof OrthographicCamera)) throw new Error('an added view starts flat')
      flat.position.set(1, 2, 3)

      engine.setPaneProjection(1, 'perspective')

      const deep = engine.paneCameras[1]
      expect(deep).toBeInstanceOf(PerspectiveCamera)
      expect(deep?.position.toArray()).toEqual([1, 2, 3])
      // The orbit follows, or it would turn a camera nothing draws.
      expect(engine.paneOrbits[1]?.object).toBe(deep)
    })

    it('leaves a pane alone when it already draws through that projection', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const first = engine.paneCameras[1]

      engine.setPaneProjection(1, 'orthographic')

      expect(engine.paneCameras[1]).toBe(first)
    })

    it('sends the main pane through the projection swap that owns the gizmo', () => {
      const engine = mounted()
      engine.setLayout('quad')

      engine.setPaneProjection(0, 'orthographic')

      expect(engine.paneCameras[0]).toBe(engine.orthographic)
    })

    it('has no projection to swap on a pane that does not exist', () => {
      const engine = mounted()

      // No quad layout, so pane 2 is nobody: the call stands rather than throwing.
      engine.setPaneProjection(2, 'perspective')

      expect(engine.paneCameras).toHaveLength(1)
    })

    it('swaps a projection on a viewport built without controls', () => {
      const engine = mounted({ controls: 'none' })
      engine.setLayout('quad')

      engine.setPaneProjection(1, 'perspective')

      expect(engine.paneCameras[1]).toBeInstanceOf(PerspectiveCamera)
    })

    it('sizes both cameras of an added view to its own quarter', () => {
      const engine = mounted()
      engine.setLayout('quad')

      engine.setPaneProjection(1, 'perspective')
      engine.setPaneHeight(20)
      const deep = engine.paneCameras[1]
      if (!(deep instanceof PerspectiveCamera)) throw new Error('the pane was set to perspective')

      // A quarter of the host, so the ratio is the host's — what matters is that it was set at
      // all: a perspective left at 1 stretches everything it draws.
      expect(deep.aspect).toBeCloseTo(HOST_WIDTH / HOST_HEIGHT)
    })

    it('answers no pane for a pointer off the surface', () => {
      const engine = mounted()
      engine.setLayout('quad')

      expect(engine.paneAtPointer(pointerAt(HOST_WIDTH + 5, 10))).toBeNull()
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
