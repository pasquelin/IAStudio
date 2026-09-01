import {
  ACESFilmicToneMapping,
  Color,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  type WebGLRenderTarget,
} from 'three'
import type * as ThreeModule from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INSET_CADENCE_MS, ViewportEngine, type DrawRequest } from './ViewportEngine'

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
const contextLost = vi.fn()
const sized = vi.fn()
const pixelRatio = vi.fn()
const rendered = vi.fn()
const viewported = vi.fn()
const scissored = vi.fn()
const scissorTest = vi.fn()
const clearColor = vi.fn()
const cleared = vi.fn()
const renderTarget = vi.fn()
/** Whether the shadow maps were drawn again, one entry per `render` — three.js reads it once. */
let shadowDraws: boolean[] = []
/** What the display is worth. Two is a laptop retina screen, which is where the fault showed. */
let displayRatio = 1

vi.mock('three', async importOriginal => ({
  ...(await importOriginal<typeof ThreeModule>()),
  WebGLRenderer: class {
    readonly domElement: HTMLCanvasElement
    readonly shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false }
    /** What the preview target is sized against: the drawing buffer's own sample count. */
    readonly capabilities = { maxSamples: 4 }
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
    forceContextLoss = contextLost
    dispose = disposed
    setViewport = viewported
    setScissor = scissored
    setScissorTest = scissorTest
    // The preview clears its own rectangle before drawing, so it reads the clear colour back to
    // put it where it found it. A double that answered nothing here failed inside the frame loop.
    getClearColor = (target: { set: (hex: number) => unknown }): unknown => target.set(0x000000)
    getClearAlpha = (): number => 1
    setClearColor = clearColor
    clear = cleared
    getPixelRatio = (): number => displayRatio
    /** What the preview draws into, and what `GpuPipeline` puts back after compositing. */
    private bound: unknown = null
    setRenderTarget = (target: unknown): void => {
      this.bound = target
      renderTarget(target)
    }
    getRenderTarget = (): unknown => this.bound
    getContext = (): { SAMPLES: number; getParameter: () => number } => ({
      SAMPLES: 0x80a9,
      getParameter: () => 4,
    })
    render = (...args: unknown[]): void => {
      if (this.info.autoReset) this.info.reset()
      this.info.render.calls += 1
      // To the letter of `WebGLShadowMap.render`: it draws when told to, then says so no more.
      const drawing =
        this.shadowMap.enabled && (this.shadowMap.autoUpdate || this.shadowMap.needsUpdate)
      shadowDraws.push(drawing)
      if (drawing) this.shadowMap.needsUpdate = false
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
  let observations: (() => void)[]

  beforeEach(() => {
    vi.clearAllMocks()
    shadowDraws = []
    // `performance` among them: the preview holds itself to a cadence, and a clock the test
    // cannot move would make that cadence depend on how fast the machine ran the assertions.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
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

    // Broadcast by hand for the same reason: the browser delivers observations after the frame
    // callbacks of the turn that is about to paint, and that order is what this file measures.
    observations = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}

        // Recorded on `observe` and not in the constructor: an engine that built an observer and
        // never pointed it at its canvas would follow nothing, and would still read as green.
        observe(): void {
          observations.push(() => this.callback([], this))
        }

        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  afterEach(() => {
    for (const engine of engines) engine.dispose()
    vi.useRealTimers()
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

  /** A splitter moved: the host is laid out anew, and the browser reports it before painting. */
  const observeResize = (): void => {
    for (const observation of observations) observation()
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

    /** The corner preview, as the component opens it: a rect, a backdrop, not grown. */
    const insetPane = (over: Partial<Parameters<ViewportEngine['setInsetPane']>[0]> = {}) => ({
      camera: new PerspectiveCamera(),
      cameraNodeId: null,
      backdrop: new Color(),
      rect: { x: 500, y: 700, width: 100, height: 56 },
      full: false,
      ...over,
    })

    /**
     * Seen on screen before it was written down: a scene with no background of its own draws
     * NOTHING where it is empty, so the panes underneath showed straight through the picture and
     * the preview read as a hole in the view. Cleared inside its own target now, which is why the
     * colour is asserted rather than the scissor — and put back for the frames after.
     */
    it('clears the preview to its own backdrop before drawing it', () => {
      const engine = atRest()
      clearColor.mockClear()

      const backdrop = new Color('#123456')
      engine.setInsetPane(insetPane({ backdrop }))
      drawFrames()

      expect(clearColor).toHaveBeenNthCalledWith(1, backdrop, 1)
      // Put back, and with the alpha it was read with: every later frame clears to what the
      // viewport itself uses, not to the preview's colour.
      expect(clearColor).toHaveBeenLastCalledWith(expect.any(Color), 1)
    })

    it('draws the camera preview into a target and composites it, never a second context', () => {
      const engine = atRest()
      rendered.mockClear()
      renderTarget.mockClear()

      engine.setInsetPane(insetPane())
      drawFrames()

      // The panes, the preview into its target, the quad that puts it on the canvas.
      expect(rendered).toHaveBeenCalledTimes(3)
      expect(renderTarget).toHaveBeenCalledWith(expect.objectContaining({ isRenderTarget: true }))
      expect(renderTarget).toHaveBeenLastCalledWith(null)
      // Bottom-right, in WebGL's own frame: the host is 800 tall, so a rect 700 down sits at 44.
      expect(scissored).toHaveBeenCalledWith(500, HOST_HEIGHT - 700 - 56, 100, 56)
      expect(scissorTest).toHaveBeenLastCalledWith(false)
    })

    /**
     * The whole point of the target: a frame in which nothing a scene camera films has moved —
     * an orbit, a fly, damping settling — composites the picture already drawn rather than
     * walking the scene a second time. Measured on 1 504 nodes, that second walk cost 5,1 ms of
     * CPU against 0,38 ms of GPU.
     */
    it('composites the picture again rather than redrawing it while nothing it shows has moved', () => {
      const engine = atRest()
      engine.setInsetPane(insetPane())
      drawFrames()
      rendered.mockClear()

      engine.requestRender()
      drawFrames()

      // The panes and the quad. The preview itself is not drawn again.
      expect(rendered).toHaveBeenCalledTimes(2)
    })

    it('draws it again once what it shows has changed', () => {
      const engine = atRest()
      engine.setInsetPane(insetPane())
      drawFrames()
      rendered.mockClear()

      engine.invalidateInset()
      // Past the cap, so the change is not the one being held back — see the test below.
      vi.advanceTimersByTime(100)
      engine.requestRender()
      drawFrames()

      expect(rendered).toHaveBeenCalledTimes(3)
    })

    /** A corner monitor at 30 Hz beside a view at 120 reads as live and costs a quarter as much. */
    it('holds the preview to its own cadence while what it shows keeps changing', () => {
      const engine = atRest()
      engine.setInsetPane(insetPane())
      drawFrames()
      rendered.mockClear()

      // Three frames of playback well inside one cadence window — the panes follow every one.
      for (let frame = 0; frame < 3; frame += 1) {
        engine.invalidateInset()
        vi.advanceTimersByTime(5)
        engine.requestRender()
        drawFrames()
      }

      // Three pane passes and three quads. The preview itself was not drawn once.
      expect(rendered).toHaveBeenCalledTimes(6)
    })

    /**
     * A target that has just been made holds nothing, so the cadence must not hold its first
     * draw back — compositing it before then samples an empty texture, and a panel dragged wider
     * would flash the preview black for as long as the cap lasts.
     */
    it('draws into a resized target at once, whatever the cadence would have said', () => {
      const engine = atRest()
      engine.setInsetPane(insetPane())
      drawFrames()
      rendered.mockClear()

      // Inside the cadence window on purpose: this is the frame the cap would have held back.
      vi.advanceTimersByTime(5)
      engine.setInsetPane(insetPane({ rect: { x: 500, y: 700, width: 200, height: 112 } }))
      drawFrames()

      // The panes, the preview into its new target, the quad.
      expect(rendered).toHaveBeenCalledTimes(3)
    })

    /**
     * A change held back by the cap must not be the last word: the frame it arrived on may be the
     * one the loop goes to sleep after, and the preview would keep showing the instant before.
     */
    it('wakes itself to catch up on a change the cadence held back', () => {
      const engine = atRest()
      engine.setInsetPane(insetPane())
      drawFrames()
      rendered.mockClear()

      engine.invalidateInset()
      vi.advanceTimersByTime(8)
      engine.requestRender()
      drawFrames()
      expect(rendered).toHaveBeenCalledTimes(2)

      // Nobody asks for anything more; the wake the engine set for itself is what draws it.
      vi.advanceTimersByTime(INSET_CADENCE_MS)
      drawFrames()
      expect(rendered).toHaveBeenCalledTimes(5)
    })

    /**
     * Grown, the preview hides the panes whole — and the panes were still being drawn under it,
     * because the rect handed over is the INSIDE of the DOM frame and never measured as covering
     * the canvas. Told rather than measured, so the saving actually happens.
     */
    it('skips the panes under a preview grown to the whole view', () => {
      const engine = atRest()
      rendered.mockClear()

      engine.setInsetPane(
        insetPane({
          full: true,
          rect: { x: 2, y: 2, width: HOST_WIDTH - 4, height: HOST_HEIGHT - 4 },
        }),
      )
      drawFrames()

      // The preview into its target, and the quad. No pane pass at all.
      expect(rendered).toHaveBeenCalledTimes(2)
      // The two pixels of canvas the DOM frame leaves outside the picture, which no pane covers
      // any more: cleared, or they would hold whatever the last frame that drew them left.
      expect(scissored).toHaveBeenCalledWith(0, 0, HOST_WIDTH, HOST_HEIGHT)
    })

    /**
     * `render` redoes the world matrices from scratch, and the pane pass of this frame has just
     * done them over a scene nothing has moved since — 1,2 ms of the 5,1 the second pass cost.
     * Only when the panes ran: a grown preview skips them, and the preview camera is a node of
     * the scene, so its own world matrix rides on that traversal.
     *
     * The shadow maps used to be spared here too. They are spared for the whole frame now — see
     * the shadow maps this viewport reuses.
     */
    it('leaves the matrices of the frame alone, and puts the flag back', () => {
      const engine = atRest()

      const seen: boolean[] = []
      rendered.mockImplementation(() => seen.push(engine.scene.matrixWorldAutoUpdate))

      engine.setInsetPane(insetPane())
      drawFrames()

      // Panes, preview, quad — and only the preview is spared.
      expect(seen).toEqual([true, false, true])
      expect(engine.scene.matrixWorldAutoUpdate).toBe(true)
    })

    it('keeps them on for a grown preview, which has no pane pass to ride on', () => {
      const engine = atRest()
      const renderer = engine.gl
      if (!renderer) throw new Error('the viewport mounts a renderer')

      const seen: boolean[] = []
      rendered.mockImplementation(() => seen.push(engine.scene.matrixWorldAutoUpdate))

      engine.setInsetPane(insetPane({ full: true }))
      drawFrames()

      expect(seen).toEqual([true, true])
    })

    it('hides the workshop for the preview pass and puts it back after', () => {
      const restore = vi.fn()
      const hide = vi.fn(() => restore)
      const engine = atRest({ onInset: hide })

      engine.setInsetPane(insetPane({ rect: { x: 0, y: 0, width: 100, height: 56 } }))
      drawFrames()

      expect(hide).toHaveBeenCalledTimes(1)
      expect(restore).toHaveBeenCalledTimes(1)
    })

    /** A composited frame draws no scene, so it must not hide the workshop of the one on screen. */
    it('leaves the workshop alone on a frame that only composites', () => {
      const restore = vi.fn()
      const hide = vi.fn(() => restore)
      const engine = atRest({ onInset: hide })

      engine.setInsetPane(insetPane())
      drawFrames()
      hide.mockClear()

      engine.requestRender()
      drawFrames()

      expect(hide).not.toHaveBeenCalled()
    })

    // Without this a drag inside the preview would orbit the view underneath it.
    it('answers no pane for a pointer inside the preview', () => {
      const engine = atRest()
      engine.setInsetPane(insetPane())

      expect(engine.paneAtPointer(pointerAt(550, 720))).toBeNull()
      expect(engine.paneAtPointer(pointerAt(100, 100))).toBe(0)
    })

    it('draws a locked pane through the camera it was lent, and gives it the orbit', () => {
      const engine = atRest()
      engine.setLayout('quad')
      const lent = new PerspectiveCamera()

      engine.setPaneCamera(1, lent)

      expect(engine.paneCameras[1]).toBe(lent)
      // The orbit follows, or a drag in that pane would turn a camera nobody is drawing.
      expect(engine.paneOrbits[1]?.object).toBe(lent)
    })

    /**
     * `OrbitControls.update()` ends on `object.lookAt(target)`. Left where the pane last
     * orbited, that target swung the borrowed camera round the moment it was lent — and again
     * on every frame the pointer merely hovered the pane, with no gesture to report it.
     */
    it('leaves a borrowed camera aimed where it already was', () => {
      const engine = atRest()
      engine.setLayout('quad')

      const lent = new PerspectiveCamera()
      lent.position.set(0, 0, 10)
      lent.lookAt(0, 0, 0)
      const before = lent.quaternion.clone()

      engine.setPaneCamera(1, lent)
      engine.paneOrbits[1]?.update()

      expect(lent.quaternion.angleTo(before)).toBeCloseTo(0, 6)
    })

    it('sizes a borrowed camera to the pane it draws into', () => {
      const engine = atRest()
      engine.setLayout('quad')
      const lent = new PerspectiveCamera()

      engine.setPaneCamera(1, lent)

      // A camera of the scene is built square; the pane is a quarter of the host.
      expect(lent.aspect).toBeCloseTo(HOST_WIDTH / HOST_HEIGHT, 6)
    })

    it('gives a pane its own camera back when the loan ends', () => {
      const engine = atRest()
      engine.setLayout('quad')
      const own = engine.paneCameras[1]

      engine.setPaneCamera(1, new PerspectiveCamera())
      engine.setPaneCamera(1, null)

      expect(engine.paneCameras[1]).toBe(own)
    })

    // Which pane settled is what tells a caller whether a gesture moved the VIEW or a camera of
    // the scene — the two land in different places, and one of them is an edit.
    it('says which pane a settled orbit belongs to', () => {
      const settled = vi.fn()
      const engine = atRest({ onCameraSettled: settled })
      engine.setLayout('quad')

      engine.orbit?.dispatchEvent({ type: 'end' })
      expect(settled).toHaveBeenLastCalledWith(0)

      engine.paneOrbits[1]?.dispatchEvent({ type: 'end' })
      expect(settled).toHaveBeenLastCalledWith(1)
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

    /**
     * The seam `TransformControls` needs: it grabs from the camera it holds, so whoever aims it
     * has to run before the canvas hears the event. Through the viewport rather than a listener
     * of the caller's own, or the order would rest on which `mount` ran first.
     *
     * **What this does NOT prove**: that a CAPTURE is required. Measured — a bubble listener
     * posted at mount already runs before one a caller adds later, so this case is green against
     * the arrangement this lot replaced. What the capture buys is running ahead of the main
     * `OrbitControls`, built inside `mount` before the arming was, and nothing here covers that.
     */
    it('says the pane is armed before the canvas hears the event, and says it while frozen', () => {
      const armed: number[] = []
      const engine = mounted({ onPaneArmed: () => armed.push(engine.activePane) })
      engine.setLayout('quad')
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      const afterCanvas: number[] = []
      canvas.addEventListener('pointermove', () => afterCanvas.push(armed.length))
      canvas.dispatchEvent(pointerAt(HOST_WIDTH - 10, HOST_HEIGHT - 10))

      expect(armed).toEqual([3])
      expect(afterCanvas).toEqual([1])

      // Frozen, nothing is armed — but the caller still has to be told, since thawing happens
      // from that very call. Without it a freeze that outlived its gesture would never lift.
      engine.freezePanes(true)
      canvas.dispatchEvent(pointerAt(10, 10))

      expect(engine.activePane).toBe(3)
      expect(armed).toHaveLength(2)
    })

    /**
     * A gizmo handle held, a camera flying: the gesture belongs to whoever started it. Without
     * this the arming above answered every pixel of that same drag — the view orbited under the
     * handle being pulled, and the working view could change halfway through.
     */
    it('arms nothing while another gesture holds the pointer, and gives it back after', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      canvas.dispatchEvent(pointerAt(10, 10))
      engine.freezePanes(true)
      canvas.dispatchEvent(pointerAt(HOST_WIDTH - 10, HOST_HEIGHT - 10))

      expect(engine.paneOrbits.map(orbit => orbit?.enabled)).toEqual([false, false, false, false])
      expect(engine.activePane).toBe(0)

      engine.freezePanes(false)

      // The pane the pointer STANDS in, not the one it was in when the gesture began: the move
      // that lifts a freeze is the one this returned early on, so reading the pane held before
      // would leave the working view — and the camera a gizmo grabs from — one event behind.
      expect(engine.activePane).toBe(3)
      expect(engine.paneOrbits.map(orbit => orbit?.enabled)).toEqual([false, false, false, true])
    })

    /** Off the surface entirely — a drag released outside the window — there is no pane to read. */
    it('keeps the pane it had when thawing with the pointer off the canvas', () => {
      const engine = mounted()
      engine.setLayout('quad')
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      canvas.dispatchEvent(pointerAt(HOST_WIDTH - 10, HOST_HEIGHT - 10))
      engine.freezePanes(true)
      canvas.dispatchEvent(pointerAt(-40, -40))
      engine.freezePanes(false)

      expect(engine.activePane).toBe(3)
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

    /**
     * What a control reading its own pointer events has to be told, `TransformControls` being
     * the one that does: unset, it normalises a click against the whole canvas — four times the
     * pane its handles are drawn in — and no handle ever lights up in a quad layout.
     */
    it('gives the active pane bottom-left, and none of it while there is one view', () => {
      const engine = mounted()
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')

      expect(engine.activePaneRegion()).toBeNull()

      engine.setLayout('quad')
      canvas.dispatchEvent(pointerAt(HOST_WIDTH - 10, HOST_HEIGHT - 10))

      // The bottom-right pane, which is where a bottom-left origin puts its own zero.
      expect(engine.activePaneRegion()).toEqual({
        x: HOST_WIDTH / 2,
        y: 0,
        width: HOST_WIDTH / 2,
        height: HOST_HEIGHT / 2,
      })
    })

    /** The seam a per-view display mode hangs on: each pane is announced before its own pass. */
    it('says which pane is about to be drawn, before drawing it', () => {
      const dressed: number[] = []
      const engine = atRest({
        onPane: index => {
          dressed.push(index)
          return false
        },
      })

      engine.setLayout('quad')
      dressed.length = 0
      drawFrames()

      expect(dressed).toEqual([0, 1, 2, 3])
    })

    it('announces the one pane of a single layout too', () => {
      const dressed: number[] = []
      const engine = atRest({
        onPane: index => {
          dressed.push(index)
          return false
        },
      })

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

  describe('following its host', () => {
    /**
     * `setSize` blanks the drawing buffer, and an observation lands after the frame callbacks of
     * the paint that follows: a frame merely asked for here is one paint late, and every paint
     * of a dragged splitter shows an empty viewport.
     */
    it('draws the new size in the turn it is measured, not on the next frame', () => {
      atRest({ controls: 'none', onFrame: () => false })
      rendered.mockClear()

      observeResize()

      expect(rendered).toHaveBeenCalled()
      expect(frames.size).toBe(0)
    })

    /** The frame the motion had already asked for is the one drawn, rather than a second one. */
    it('draws once and keeps the loop when the resize lands mid-motion', () => {
      atRest({ controls: 'none', onFrame: () => true })
      rendered.mockClear()

      observeResize()

      expect(rendered).toHaveBeenCalledTimes(1)
      expect(frames.size).toBe(1)
    })

    /** A panel folded to nothing: the surface is refused, so the frame stays owed to its paint. */
    it('spends no frame on an observation it turns back', () => {
      const engine = atRest({ controls: 'none', onFrame: () => true })
      const canvas = engine.canvas
      if (!canvas) throw new Error('mounted with no canvas')
      Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 0 })
      rendered.mockClear()

      observeResize()

      expect(rendered).not.toHaveBeenCalled()
      expect(frames.size).toBe(1)
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
      expect(contextLost).toHaveBeenCalled()
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

  /**
   * A shadow map is drawn FROM A LIGHT, never from the camera, so an orbit can reuse the one the
   * last frame drew. Measured on this Mac at 1600×900 while orbiting 400 shadowed spheres:
   * 2,6 ms against 1,9 for one sun, 4,9 against 2,2 for four point lights.
   *
   * The direction of the mistake is what matters: reusing when something moved shows a shadow of
   * what WAS, and no gate would go red on it.
   */
  describe('and the shadow maps it reuses', () => {
    const shadowed = (): ViewportEngine => atRest({ shadows: true })

    it('draws them again on a frame anything but the camera asked for', () => {
      const engine = shadowed()
      shadowDraws.length = 0

      engine.requestRender()
      drawFrames()

      expect(shadowDraws).toContain(true)
    })

    it('reuses them on a frame the camera alone asked for', () => {
      const engine = shadowed()
      engine.requestRender()
      drawFrames()
      shadowDraws.length = 0

      engine.requestCameraRender()
      drawFrames()

      expect(shadowDraws).not.toContain(true)
    })

    it('draws them again for a pane that changed what the scene wears', () => {
      // A quad layout where one pane puts the scene's lights out for a material preview: its
      // maps are drawn from a scene the pane beside it is not showing.
      const engine = atRest({ shadows: true, onPane: index => index === 2 })
      engine.setLayout('quad')
      drawFrames()
      shadowDraws.length = 0

      engine.requestCameraRender()
      drawFrames()

      // The third pane alone, and not the three that wear what is already on.
      expect(shadowDraws).toEqual([false, false, true, false])
    })

    it('leaves them armed for whatever renders between two frames', () => {
      const engine = shadowed()
      const renderer = engine.gl
      if (!renderer) throw new Error('the viewport mounts a renderer')

      engine.requestCameraRender()
      drawFrames()

      // A film being written out, a capture, a scene clip: none comes through the frame loop and
      // none would know to ask. An exported video was reusing the maps of the pose Render was
      // pressed on, with an animated character moving over a shadow that stood still.
      expect(renderer.shadowMap.needsUpdate).toBe(true)
    })

    it('draws them again when something moves mid-orbit', () => {
      const engine = shadowed()
      engine.requestCameraRender()
      // Both in the same turn, and the camera one first: the frame is already asked for, so a
      // scene change that only scheduled would be drawn against the shadows of the last one.
      engine.requestRender()
      shadowDraws.length = 0
      drawFrames()

      expect(shadowDraws).toContain(true)
    })
  })

  /**
   * A film and a still hand `drawScene` a target and then read its pixels straight back — so
   * whoever draws has to be pointed at it first.
   *
   * Not academic: a composition planning no pass answers `false` without `PostComposer` ever
   * running, and every scene from the default template is in that state. Unbound, the render
   * went to the CANVAS and the read came back off a target nothing had written — a black film
   * and a black still, on exactly the scenes that use no composition.
   */
  describe('drawing into a target', () => {
    // Only `isRenderTarget` is read here, and by the stand-in alone: building a real one asks
    // jsdom for a WebGL context, which is the very thing this suite stands in for.
    const target = { isRenderTarget: true, width: 64, height: 48 } as unknown as WebGLRenderTarget

    const request = (onto: WebGLRenderTarget | null): DrawRequest => ({
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      surface: 'offscreen',
      paneIndex: 0,
      cameraNodeId: null,
      target: onto,
      rect: null,
      width: 64,
      height: 48,
    })

    it('binds the target before it renders', () => {
      const engine = atRest()
      renderTarget.mockClear()
      rendered.mockClear()

      expect(engine.drawScene(request(target))).toBe(false)

      expect(renderTarget).toHaveBeenLastCalledWith(target)
      expect(rendered).toHaveBeenCalledTimes(1)
    })

    // And it binds it for whoever ELSE draws, not only for its own fallback: the composer is
    // handed the request after the target is bound, so a chain drawing into it cannot miss.
    it('binds the target before handing the request over', () => {
      const seen: (WebGLRenderTarget | null)[] = []
      const engine = atRest({
        onDraw: () => {
          seen.push(renderTarget.mock.calls.at(-1)?.[0] ?? null)
          return true
        },
      })
      renderTarget.mockClear()
      rendered.mockClear()

      expect(engine.drawScene(request(target))).toBe(true)

      expect(seen.at(-1)).toBe(target)
      // It said it drew, so the viewport must not draw a second time over it.
      expect(rendered).not.toHaveBeenCalled()
    })

    it('points back at the canvas for a request that names none', () => {
      const engine = atRest()
      renderTarget.mockClear()

      engine.drawScene(request(null))

      expect(renderTarget).toHaveBeenLastCalledWith(null)
    })
  })
})
