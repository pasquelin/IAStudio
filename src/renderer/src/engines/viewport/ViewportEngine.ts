import {
  ACESFilmicToneMapping,
  Color,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { token } from '../core/palette'
import { frameDelta } from './frame-clock'
import { pointerNdc, type PointerPosition } from './pointer'

/**
 * The parts of a viewport every workspace repeats: a canvas it owns, a renderer, a camera that
 * follows the element's aspect, orbit controls, and a loop that only runs while something
 * moves. Three workspaces show 3D — the scene editor, textures and skyboxes — and each one
 * writing this again is three chances for them to disagree about resizing or disposal.
 *
 * What it deliberately does not know: gizmos, selection, outliners, grids. Those belong to
 * whoever mounts it, which is why `scene` and `camera` are handed over rather than hidden.
 */

export type ViewportEngineOptions = {
  /**
   * Advances whatever the caller animates, and reports whether it still moves. Returning true
   * keeps the loop alive for another frame; returning false lets the viewport go back to sleep.
   */
  onFrame?: (delta: number) => boolean
  /** Drawn after the scene with `autoClear` off — trihedrons and other screen-space overlays. */
  onOverlay?: (renderer: WebGLRenderer) => void
  /**
   * Filmic tone mapping. Off by default because it changes how every existing colour lands,
   * and the scene editor was built and reviewed without it; a viewport that judges an HDR
   * environment turns it on.
   */
  toneMapping?: boolean
  /**
   * Whether the renderer draws shadow maps at all. Off by default, and left off by the two
   * viewports that show one lit object on a studio environment: enabling it costs a depth pass
   * per shadow-casting light, for surfaces that would catch nothing.
   */
  shadows?: boolean
  /**
   * `orbit` circles a target — the scene editor and a texture on its sphere. `none` leaves the
   * camera where it is put, for a viewport whose camera sits at the centre and only turns its
   * head; orbiting with the target pinned at the centre would need the distance locked to
   * nearly zero, which costs the rotation its precision.
   */
  controls?: 'orbit' | 'none'
  fieldOfView?: number
  near?: number
  far?: number
}

/** Seconds. Longer than this and a background tab would fly the camera across the scene. */
const MAX_DELTA = 0.1

export class ViewportEngine {
  readonly scene = new Scene()
  readonly camera: PerspectiveCamera

  private renderer: WebGLRenderer | null = null
  private controls: OrbitControls | null = null
  private observer: ResizeObserver | null = null
  private frame: number | null = null
  /** `null` while the loop is at rest: the next frame is a first frame, not a long one. */
  private lastTime: number | null = null

  constructor(private readonly options: ViewportEngineOptions = {}) {
    this.camera = new PerspectiveCamera(
      options.fieldOfView ?? 60,
      1,
      options.near ?? 0.1,
      options.far ?? 1000,
    )
  }

  /** Makes its own canvas: React must never own it — see the engine invariants in CLAUDE.md. */
  mount(host: HTMLElement): void {
    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    // Appended before anything reads the palette: `getComputedStyle` only inherits the studio
    // tokens once the element is actually in the document.
    host.appendChild(canvas)

    const renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.toneMapping = this.options.toneMapping ? ACESFilmicToneMapping : NoToneMapping
    renderer.shadowMap.enabled = this.options.shadows ?? false
    this.renderer = renderer

    if (this.options.controls !== 'none') {
      this.controls = new OrbitControls(this.camera, canvas)
      this.controls.enableDamping = true
      this.controls.addEventListener('change', this.requestRender)
    }

    this.observer = new ResizeObserver(this.onResize)
    this.observer.observe(canvas)
    this.onResize()
  }

  dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null

    this.observer?.disconnect()
    this.observer = null

    this.controls?.removeEventListener('change', this.requestRender)
    this.controls?.dispose()
    this.controls = null

    const canvas = this.renderer?.domElement
    this.renderer?.dispose()
    this.renderer = null

    // The canvas goes with the engine that made it: left behind, the next mount would stack a
    // second one on top of it and the host would keep growing a dead canvas per remount.
    canvas?.remove()
  }

  get canvas(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null
  }

  /** The renderer itself, for the passes and overlays that have to draw with it. */
  get gl(): WebGLRenderer | null {
    return this.renderer
  }

  get orbit(): OrbitControls | null {
    return this.controls
  }

  /** Reads a studio token off the canvas, so a viewport follows a theme change with the rest. */
  paletteToken(name: string): string {
    const canvas = this.renderer?.domElement
    return canvas ? token(canvas, name) : ''
  }

  setBackgroundColor(css: string): void {
    this.scene.background = css ? new Color(css) : null
    this.requestRender()
  }

  setFieldOfView(degrees: number): void {
    if (this.camera.fov === degrees) return
    this.camera.fov = degrees
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  /** Where a pointer sits in device coordinates, or `null` if the canvas has no surface yet. */
  pointerNdcOf(pointer: PointerPosition): { x: number; y: number } | null {
    const canvas = this.renderer?.domElement
    return canvas ? pointerNdc(pointer, canvas.getBoundingClientRect()) : null
  }

  /**
   * Starts the frame clock now. A caller about to animate calls this first, or the first delta
   * it receives spans everything since the last frame — which was the last time anything moved,
   * possibly minutes ago — and the motion opens with a jump.
   */
  resetClock(): void {
    this.lastTime = performance.now()
  }

  readonly requestRender = (): void => {
    if (this.frame !== null || this.renderer === null) return
    this.frame = requestAnimationFrame(this.renderFrame)
  }

  private readonly onResize = (): void => {
    const canvas = this.renderer?.domElement
    if (!canvas || !this.renderer) return

    const { clientWidth, clientHeight } = canvas
    if (clientWidth === 0 || clientHeight === 0) return

    this.renderer.setSize(clientWidth, clientHeight, false)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  /**
   * On demand, not on a permanent loop: a studio whose viewport burns a frame at rest heats the
   * machine for nothing. The loop keeps going only while something is actually moving.
   */
  private readonly renderFrame = (): void => {
    this.frame = null
    const renderer = this.renderer
    if (!renderer) return

    const now = performance.now()
    const delta = frameDelta({
      since: this.lastTime === null ? null : now - this.lastTime,
      cap: MAX_DELTA,
    })
    this.lastTime = now

    const moving = this.options.onFrame?.(delta) ?? false

    // `update` reports whether the camera actually moved: it keeps returning true while damping
    // settles, and false once it has — which is what ends the loop instead of running forever.
    const controls = this.controls
    const settling = controls !== null && controls.enabled && controls.update()

    renderer.render(this.scene, this.camera)

    const overlay = this.options.onOverlay
    if (overlay) {
      /**
       * `autoClear` off for the overlay, as the official editor does before its own helpers.
       * `ViewHelper.render` calls `renderer.render` internally, which clears the colour buffer
       * first — and `gl.clear` ignores the viewport, so it wipes the whole frame. Left on, the
       * trihedron erases the scene it sits on and the viewport stays black.
       */
      renderer.autoClear = false
      try {
        overlay(renderer)
      } finally {
        // In a `finally`: a throw in the overlay would otherwise leave `autoClear` off for
        // good, and every later frame would smear over the last.
        renderer.autoClear = true
      }
    }

    if (moving || settling) this.requestRender()
  }
}
