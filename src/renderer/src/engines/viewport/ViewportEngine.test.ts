import { ACESFilmicToneMapping, NoToneMapping } from 'three'
import type * as ThreeModule from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ViewportEngine } from './ViewportEngine'

/**
 * A renderer jsdom can hold: the real one asks the canvas for a WebGL context and gets null.
 * Only what the engine reads back is kept — the element it draws into, and the two flags the
 * overlay pass turns on and off.
 */
const rendered = vi.fn()
const disposed = vi.fn()
const sized = vi.fn()
const pixelRatio = vi.fn()

vi.mock('three', async importOriginal => ({
  ...(await importOriginal<typeof ThreeModule>()),
  WebGLRenderer: class {
    readonly domElement: HTMLCanvasElement
    readonly shadowMap = { enabled: false }
    toneMapping = NoToneMapping
    autoClear = true

    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      this.domElement = canvas
    }

    setPixelRatio = pixelRatio
    setSize = sized
    render = rendered
    dispose = disposed
  },
}))

describe('a viewport', () => {
  let host: HTMLElement
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    vi.clearAllMocks()
    host = document.createElement('div')
    document.body.appendChild(host)

    // Frames are run by hand: a viewport that only draws on demand is unobservable otherwise,
    // and a real `requestAnimationFrame` never fires under a test runner.
    frames = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      delete frames[handle - 1]
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    host.remove()
  })

  const drawFrames = (): void => {
    const pending = frames.splice(0)
    for (const frame of pending) frame?.(performance.now())
  }

  describe('mounting', () => {
    /** React must never own the canvas — see the engine invariants in CLAUDE.md. */
    it('makes its own canvas inside the host', () => {
      new ViewportEngine().mount(host)

      const canvas = host.querySelector('canvas')
      expect(canvas).not.toBeNull()
      expect(canvas?.style.width).toBe('100%')
    })

    it('draws flat by default, and filmic when asked', () => {
      const flat = new ViewportEngine()
      flat.mount(host)
      expect(flat.gl?.toneMapping).toBe(NoToneMapping)

      const filmic = new ViewportEngine({ toneMapping: true })
      filmic.mount(host)
      expect(filmic.gl?.toneMapping).toBe(ACESFilmicToneMapping)
    })

    /** A depth pass per shadow-casting light, for surfaces that would catch nothing. */
    it('leaves shadow maps off unless a viewport asks for them', () => {
      const plain = new ViewportEngine()
      plain.mount(host)
      expect(plain.gl?.shadowMap.enabled).toBe(false)

      const lit = new ViewportEngine({ shadows: true })
      lit.mount(host)
      expect(lit.gl?.shadowMap.enabled).toBe(true)
    })

    /**
     * A camera at the centre only turns its head: orbiting with the target pinned there would
     * need the distance locked to nearly zero, which costs the rotation its precision.
     */
    it('gives no orbit to a viewport that only looks around', () => {
      const engine = new ViewportEngine({ controls: 'none' })

      engine.mount(host)

      expect(engine.orbit).toBeNull()
    })

    it('orbits by default', () => {
      const engine = new ViewportEngine()

      engine.mount(host)

      expect(engine.orbit).not.toBeNull()
    })

    it('sizes itself to the host on mount', () => {
      new ViewportEngine().mount(host)

      expect(sized).toHaveBeenCalled()
    })

    it('draws at the density of the screen it is on', () => {
      new ViewportEngine().mount(host)

      expect(pixelRatio).toHaveBeenCalledWith(window.devicePixelRatio)
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

      expect(frames).toHaveLength(0)
    })
  })

  describe('the frame loop', () => {
    it('asks for one frame however many times it is nudged', () => {
      const engine = new ViewportEngine({ controls: 'none' })
      engine.mount(host)
      // Drawn, not discarded: the engine holds its frame handle until the frame actually runs.
      drawFrames()

      engine.requestRender()
      engine.requestRender()
      engine.requestRender()

      expect(frames).toHaveLength(1)
    })

    /** A studio whose viewport burns a frame at rest heats the machine for nothing. */
    it('goes back to sleep once nothing moves', () => {
      const engine = new ViewportEngine({ controls: 'none', onFrame: () => false })
      engine.mount(host)

      drawFrames()

      expect(rendered).toHaveBeenCalled()
      expect(frames).toHaveLength(0)
    })

    it('keeps drawing while something is still moving', () => {
      const engine = new ViewportEngine({ controls: 'none', onFrame: () => true })
      engine.mount(host)

      drawFrames()

      expect(frames).toHaveLength(1)
    })

    /**
     * `ViewHelper.render` clears the colour buffer first, and `gl.clear` ignores the viewport —
     * left on, the trihedron would wipe the scene it sits on and the viewport would stay black.
     */
    it('draws the overlay without clearing what is under it', () => {
      let clearedDuringOverlay = true
      const engine = new ViewportEngine({
        controls: 'none',
        onOverlay: renderer => (clearedDuringOverlay = renderer.autoClear),
      })
      engine.mount(host)

      drawFrames()

      expect(clearedDuringOverlay).toBe(false)
      expect(engine.gl?.autoClear).toBe(true)
    })

    /** Otherwise every later frame smears over the last one, for good. */
    it('puts clearing back even when the overlay throws', () => {
      const engine = new ViewportEngine({
        controls: 'none',
        onOverlay: () => {
          throw new Error('overlay')
        },
      })
      engine.mount(host)

      expect(() => drawFrames()).toThrow('overlay')
      expect(engine.gl?.autoClear).toBe(true)
    })
  })

  describe('the field of view', () => {
    it('takes the new angle and redraws', () => {
      const engine = new ViewportEngine({ controls: 'none' })
      engine.mount(host)
      drawFrames()

      engine.setFieldOfView(90)

      expect(engine.perspective.fov).toBe(90)
      expect(frames).toHaveLength(1)
    })

    it('redraws nothing when the angle does not change', () => {
      const engine = new ViewportEngine({ fieldOfView: 60, controls: 'none' })
      engine.mount(host)
      drawFrames()

      engine.setFieldOfView(60)

      expect(frames).toHaveLength(0)
    })
  })

  describe('the background', () => {
    it('takes a colour, and gives it back when asked for none', () => {
      const engine = new ViewportEngine()

      engine.setBackgroundColor('#191a1c')
      expect(engine.scene.background).not.toBeNull()

      engine.setBackgroundColor('')
      expect(engine.scene.background).toBeNull()
    })
  })

  describe('going away', () => {
    /**
     * Left behind, the next mount stacks a second canvas on top of it and the host grows a
     * dead one per remount.
     */
    it('takes its canvas with it', () => {
      const engine = new ViewportEngine()
      engine.mount(host)

      engine.dispose()

      expect(host.querySelector('canvas')).toBeNull()
      expect(disposed).toHaveBeenCalled()
    })

    it('drops the frame it had asked for', () => {
      const engine = new ViewportEngine({ controls: 'none' })
      engine.mount(host)
      engine.requestRender()

      engine.dispose()

      // The frame is cancelled, not merely made harmless: a callback left queued keeps the
      // whole engine alive until it runs, and `renderFrame` bailing out would hide that.
      expect(frames.filter(Boolean)).toHaveLength(0)
      drawFrames()
      expect(rendered).not.toHaveBeenCalled()
    })

    it('disposes cleanly when it was never mounted', () => {
      expect(() => new ViewportEngine().dispose()).not.toThrow()
    })
  })
})
