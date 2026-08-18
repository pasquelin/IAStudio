import {
  ACESFilmicToneMapping,
  Color,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { token } from '../core/palette'
import { frameDelta } from './frameClock'
import { emptyGpuStats, recordFrame, type GpuStats } from './gpuStats'
import {
  glRect,
  inRect,
  paneAt,
  paneCount,
  paneRects,
  type PaneLayout,
  type PaneRect,
} from './panes'
import { pointerNdc, type PointerPosition } from './pointer'

/** Where an unmounted viewport orbits, having no controls to hold a target. Never written to. */
const ORIGIN = new Vector3()

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
   * Called just before each pane is drawn, so whoever owns the scene can say how THIS view shows
   * it. The one seam that makes a per-view display mode possible: `overrideMaterial` and a
   * camera's layers are read at render time, so a pane's answer only has to hold for its own pass.
   */
  onPane?: (index: number, camera: ViewportCamera) => void
  /**
   * Called around the inset pass, and it hands back the call that undoes whatever it did.
   *
   * The seam a preview needs and `onPane` cannot give: a preview shows what the camera FILMS, so
   * the grid and the helpers have to be hidden for that pass and put back for the next — and
   * `onPane` has no symmetrical call after a pane is drawn.
   */
  onInset?: () => () => void
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
  /**
   * The hand has let go of the camera. Fired once per gesture, never per frame of it: whoever
   * listens publishes where the view now stands, and a store written sixty times a second
   * would repaint everything reading it for a drag that is not over.
   */
  onCameraSettled?: (pane: number) => void
  fieldOfView?: number
  near?: number
  far?: number
}

/**
 * What a viewport drawing for something other than a screen asks for — see `configureOutput`.
 *
 * Both have to be settled before the renderer exists: `alpha` is a context attribute WebGL only
 * reads at creation, and a device ratio applied afterwards would resize a buffer already sized.
 */
export type ViewportOutput = {
  /**
   * Device pixels per CSS pixel. Left to the screen's own by default; a viewport rendering into
   * a video frame wants exactly one, since the frame's size IS the pixel count asked for.
   */
  pixelRatio?: number
  /** Whether the drawing buffer keeps an alpha channel, so what is behind the scene stays clear. */
  alpha?: boolean
}

/** Seconds. Longer than this and a background tab would fly the camera across the scene. */
const MAX_DELTA = 0.1

/**
 * How a viewport projects. Perspective everywhere by default: only the scene editor offers the
 * other one, where parallel edges have to read as parallel to judge an alignment.
 */
export type ProjectionKind = 'perspective' | 'orthographic'

export type ViewportCamera = PerspectiveCamera | OrthographicCamera

/** A camera drawn over the panes, in a rectangle of its own — the camera preview. */
export type InsetPane = {
  camera: PerspectiveCamera
  /** In CSS pixels, origin top-left, like every other pane rect. */
  rect: PaneRect
}

/**
 * One of the views beside the main one. It carries both cameras, exactly as the main one does:
 * a quarter set to a side is flat — converging edges are the one thing a side view rules out —
 * but a quarter set free is a second perspective, which is a layout the user may ask for.
 */
type ExtraPane = {
  perspective: PerspectiveCamera
  orthographic: OrthographicCamera
  projection: ProjectionKind
  controls: OrbitControls | null
  /** A camera of the SCENE this pane draws through instead of its own — see `setPaneCamera`. */
  borrowed: PerspectiveCamera | null
}

/**
 * How tall a pane's frustum is by default, before anything frames a selection into it. Half a
 * dozen studio units: a primitive dropped at the origin lands inside it rather than filling it.
 */
const EXTRA_PANE_HEIGHT = 6

/** The camera an added view is currently drawing through — a borrowed one wins over both. */
function cameraOf(pane: ExtraPane): ViewportCamera {
  if (pane.borrowed) return pane.borrowed
  return pane.projection === 'perspective' ? pane.perspective : pane.orthographic
}

export class ViewportEngine {
  readonly scene = new Scene()
  /** The perspective one is the default, and the only one the two other 3D spaces ever draw with. */
  readonly perspective: PerspectiveCamera
  readonly orthographic = new OrthographicCamera()
  private projection: ProjectionKind = 'perspective'

  private renderer: WebGLRenderer | null = null
  private output: ViewportOutput = {}
  private controls: OrbitControls | null = null
  private observer: ResizeObserver | null = null
  private layout: PaneLayout = 'single'
  /** Pane 0 until a pointer says otherwise, which is the only pane a single layout has. */
  private active = 0
  /**
   * The views beside the main one, which is always pane 0 and always the one that was already
   * there. Empty in a single layout, so every viewport that never asks for four draws exactly
   * what it drew before — one camera, one render, no scissor.
   */
  private readonly extras: ExtraPane[] = []
  /** Where each pane sits, in CSS pixels. One entry in a single layout, four in a quad. */
  private rects: PaneRect[] = []
  /** What the camera preview shows, or `null` when it is closed. */
  private inset: InsetPane | null = null
  /** How tall the added views see, in world units. Set by whoever knows what the scene holds. */
  private extraHeight = EXTRA_PANE_HEIGHT
  private frame: number | null = null
  /** `null` while the loop is at rest: the next frame is a first frame, not a long one. */
  private lastTime: number | null = null
  /** What the last drawn frame cost, and what the context holds. `frames` standing still is a
   * viewport that went back to sleep, which is what the loop is meant to do. */
  readonly stats: GpuStats = emptyGpuStats()

  constructor(private readonly options: ViewportEngineOptions = {}) {
    this.perspective = new PerspectiveCamera(
      options.fieldOfView ?? 60,
      1,
      options.near ?? 0.1,
      options.far ?? 1000,
    )
    this.orthographic.near = options.near ?? 0.1
    this.orthographic.far = options.far ?? 1000
  }

  /** What the viewport draws with, and what a raycast has to be set from. */
  get camera(): ViewportCamera {
    return this.projection === 'perspective' ? this.perspective : this.orthographic
  }

  /**
   * Swaps the projection, keeping the view still: the new camera takes the old one's placement,
   * and its frustum is sized so that what sits at the orbit target keeps the size it had.
   *
   * The controls are re-aimed rather than rebuilt — an orbit rebuilt mid-session would lose its
   * target, and with it the point the whole gesture turns around.
   */
  setProjection(kind: ProjectionKind): void {
    if (kind === this.projection) return

    const previous = this.camera
    // An orthographic camera zooms by scaling its frustum, never by moving — so what the wheel
    // left on it has no counterpart in one that zooms by moving. Spent as distance rather than
    // dropped: dropped, coming back to perspective threw the view out to where it stood before.
    const leavingOrthographic = this.projection === 'orthographic'
    const zoomToSpend = this.orthographic.zoom

    this.projection = kind
    const next = this.camera
    next.position.copy(previous.position)
    next.quaternion.copy(previous.quaternion)
    if (leavingOrthographic && zoomToSpend > 0 && zoomToSpend !== 1) {
      // The same fallback as `fitProjection`: with no controls, there is no target but the origin.
      const target = this.controls?.target ?? ORIGIN
      // Held inside the camera's own planes, half a plane either side. Nothing bounds an
      // orthographic zoom — `minZoom` is 0 and costs nothing to reach — and a distance spent past
      // `far` clips the target into a black viewport that no further swap recovers. A zoom simply
      // dropped only widened the view; that is the trade this bound keeps on the right side.
      next.position
        .sub(target)
        .divideScalar(zoomToSpend)
        .clampLength(this.perspective.near * 2, this.perspective.far / 2)
        .add(target)
    }
    // Carried over, a zoom from an earlier swap would apply again on top of the frustum just
    // sized for it.
    next.zoom = 1

    this.fitProjection()
    if (this.controls) this.controls.object = next
    this.requestRender()
  }

  /**
   * The camera was moved rather than turned: the orthographic frustum has to be sized again, and
   * its zoom let go with it. A perspective camera shows something new the moment it moves; an
   * orthographic one shows exactly what it showed, which is how framing a selection did nothing.
   */
  refit(): void {
    this.orthographic.zoom = 1
    this.fitProjection()
  }

  /**
   * The orthographic frustum, taken from the perspective one it stands in for: as tall at the
   * orbit target as the field of view makes it at that distance.
   */
  private fitProjection(): void {
    // The main camera's own pane, which is the whole canvas until a quad layout says otherwise.
    const main = this.rects[0]
    const aspect = main && main.height > 0 ? main.width / main.height : 1

    // Read off the camera that is drawing: while the perspective one is active, the other's
    // placement is one swap out of date, and a resize would size the frustum from where the
    // view used to be.
    const camera = this.camera
    const target = this.controls?.target
    const distance = target ? camera.position.distanceTo(target) : camera.position.length()
    const height = 2 * distance * Math.tan((this.perspective.fov * Math.PI) / 360)
    const width = height * aspect

    this.orthographic.top = height / 2
    this.orthographic.bottom = -height / 2
    this.orthographic.right = width / 2
    this.orthographic.left = -width / 2
    this.orthographic.updateProjectionMatrix()
  }

  /**
   * How the surface is divided. `quad` adds three orthographic views around the one that was
   * already there; `single` takes them away and gives the whole canvas back.
   *
   * The extra views arrive unaimed on purpose: where each one stands is a question about the
   * scene, and this module knows nothing about scenes. Whoever asks for four places them.
   */
  setLayout(layout: PaneLayout): void {
    if (layout === this.layout) return
    this.layout = layout

    if (layout === 'single') this.active = 0
    const wanted = paneCount(layout) - 1
    while (this.extras.length > wanted) this.disposeExtra()
    while (this.extras.length < wanted) this.extras.push(this.createExtra())

    this.layOutPanes()
    this.requestRender()
  }

  /**
   * How much world the added views take in. The scene editor sizes it to what the scene holds:
   * a fixed frustum shows a hand-sized model as a dot and a building as a corner of a wall.
   */
  setPaneHeight(height: number): void {
    if (height <= 0 || height === this.extraHeight) return
    this.extraHeight = height
    this.layOutPanes()
    this.requestRender()
  }

  get paneLayout(): PaneLayout {
    return this.layout
  }

  /** Every camera that draws, main one first. What a caller aims, and what a picker picks with. */
  get paneCameras(): readonly ViewportCamera[] {
    return [this.camera, ...this.extras.map(pane => cameraOf(pane))]
  }

  /** The orbit of each pane, main one first — `null` where a viewport was built without controls. */
  get paneOrbits(): readonly (OrbitControls | null)[] {
    return [this.controls, ...this.extras.map(pane => pane.controls)]
  }

  /** Pane 0 is the main camera; the rest read one past their own index. */
  private cameraOfPane(index: number): ViewportCamera | null {
    const pane = this.extras[index - 1]
    return index === 0 ? this.camera : pane ? cameraOf(pane) : null
  }

  /**
   * The pane the pointer was last over. What a command acts on: pressing a display key means
   * "this view", the way every modelling package reads it — the pointer says which one.
   */
  get activePane(): number {
    return this.active
  }

  /** Which pane a pointer is over, or `null` when it is off the surface entirely. */
  paneAtPointer(pointer: PointerPosition): number | null {
    const canvas = this.renderer?.domElement
    if (!canvas) return null

    const bounds = canvas.getBoundingClientRect()
    const x = pointer.clientX - bounds.left
    const y = pointer.clientY - bounds.top

    // The inset first, and it answers for nobody: it covers a pane rather than dividing the
    // surface, so without this a drag inside the preview would orbit the view underneath it.
    if (this.inset && inRect(this.inset.rect, x, y)) return null
    return paneAt(this.rects, x, y)
  }

  /**
   * What the preview shows, and where — `null` closes it.
   *
   * The rect comes from the caller because the DOM chrome around the preview has to land on the
   * very same pixels: one rectangle, decided once, rather than two that agree until they drift.
   */
  setInsetPane(pane: InsetPane | null): void {
    this.inset = pane
    this.requestRender()
  }

  private createExtra(): ExtraPane {
    const near = this.options.near ?? 0.1
    const far = this.options.far ?? 1000

    const orthographic = new OrthographicCamera()
    orthographic.near = near
    orthographic.far = far
    const perspective = new PerspectiveCamera(this.options.fieldOfView ?? 60, 1, near, far)
    const pane: ExtraPane = {
      perspective,
      orthographic,
      projection: 'orthographic',
      controls: null,
      borrowed: null,
    }

    const canvas = this.renderer?.domElement
    if (this.options.controls === 'none' || !canvas) return pane

    const controls = new OrbitControls(orthographic, canvas)
    controls.enableDamping = true
    controls.addEventListener('change', this.requestRender)
    // Only the pane under the pointer listens — see `armPaneUnderPointer`. Four live orbits on
    // one canvas would each answer the same drag, and the three off-screen ones would answer it
    // invisibly.
    controls.enabled = false
    // The index is read at the moment of the event rather than captured: panes are pushed after
    // this returns, so nothing here knows yet which one this will be.
    controls.addEventListener('end', () =>
      this.options.onCameraSettled?.(this.extras.indexOf(pane) + 1),
    )
    pane.controls = controls
    return pane
  }

  /**
   * Draws a pane through a camera of the SCENE rather than through its own.
   *
   * The orbit follows: left on the camera nobody is drawing, a drag would turn something
   * invisible. Handing it the borrowed camera is what makes orbiting in that pane MOVE the
   * camera of the scene — which is the whole point, and why `onCameraSettled` carries the pane.
   */
  setPaneCamera(index: number, camera: PerspectiveCamera | null): void {
    // Pane 0 draws with the viewport's own camera and reads `extras[-1]`, which is nobody.
    const pane = this.extras[index - 1]
    if (!pane || pane.borrowed === camera) return

    pane.borrowed = camera
    const drawn = cameraOf(pane)
    if (pane.controls) {
      pane.controls.object = drawn
      pane.controls.update()
    }
    this.layOutPanes()
    this.requestRender()
  }

  /**
   * Which camera an added view draws through. The controls follow: an orbit left on the camera
   * that is no longer drawn turns something nobody sees.
   */
  setPaneProjection(index: number, kind: ProjectionKind): void {
    if (index === 0) return this.setProjection(kind)

    const pane = this.extras[index - 1]
    if (!pane || pane.projection === kind) return

    const previous = pane.projection === 'perspective' ? pane.perspective : pane.orthographic
    pane.projection = kind
    const next = kind === 'perspective' ? pane.perspective : pane.orthographic
    next.position.copy(previous.position)
    next.quaternion.copy(previous.quaternion)
    if (pane.controls) pane.controls.object = next

    this.layOutPanes()
    this.requestRender()
  }

  private disposeExtra(): void {
    const pane = this.extras.pop()
    pane?.controls?.removeEventListener('change', this.requestRender)
    pane?.controls?.dispose()
  }

  /**
   * Hands the drag to the pane the pointer is over, and takes it from the others.
   *
   * Bound at mount rather than left to the caller: an orbit is the viewport's own gesture, and a
   * scene editor that had to arm it would be the second place deciding which view is being used.
   */
  private readonly armPaneUnderPointer = (event: PointerEvent): void => {
    if (this.layout === 'single') return

    const over = this.paneAtPointer(event)
    if (over !== null) this.active = over
    if (this.controls) this.controls.enabled = over === 0
    for (const [index, pane] of this.extras.entries()) {
      if (pane.controls) pane.controls.enabled = over === index + 1
    }
  }

  /**
   * Where each pane sits, and what that does to the cameras that draw into them. Hands back the
   * main pane's rectangle, which is what the caller sizing the main camera needs.
   */
  private layOutPanes(): PaneRect {
    const canvas = this.renderer?.domElement
    const width = canvas?.clientWidth ?? 0
    const height = canvas?.clientHeight ?? 0
    this.rects = paneRects(this.layout, width, height)

    for (const [index, pane] of this.extras.entries()) {
      // Pane 0 is the main camera's, so an extra reads the rect one past its own index. A pane
      // with no height is a viewport that has not been mounted yet: its frustum would come out
      // as a division by zero, and a camera holding NaN never draws again.
      const rect = this.rects[index + 1]
      if (!rect || rect.height === 0) continue

      const aspect = rect.width / rect.height
      const half = this.extraHeight / 2
      pane.orthographic.top = half
      pane.orthographic.bottom = -half
      pane.orthographic.right = half * aspect
      pane.orthographic.left = -half * aspect
      pane.orthographic.updateProjectionMatrix()
      pane.perspective.aspect = aspect
      pane.perspective.updateProjectionMatrix()
    }

    return this.rects[0] ?? { x: 0, y: 0, width, height }
  }

  /**
   * How the next mount builds its renderer. A method rather than a constructor option because
   * the engine that owns this one builds it as a field — so it has nothing to hand over yet —
   * and because both values are read once, when the WebGL context is created.
   *
   * Has no effect on a viewport already mounted: `dispose` then `mount` is what applies it.
   */
  configureOutput(output: ViewportOutput): void {
    this.output = output
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

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: this.output.alpha })
    renderer.setPixelRatio(this.output.pixelRatio ?? window.devicePixelRatio)
    // Clear to nothing rather than to a colour, so a scene drawn for compositing hands back the
    // pixels it painted and nothing else. `setClearAlpha` alone is ignored without `alpha`.
    if (this.output.alpha) renderer.setClearAlpha(0)
    renderer.toneMapping = this.options.toneMapping ? ACESFilmicToneMapping : NoToneMapping
    renderer.shadowMap.enabled = this.options.shadows ?? false
    // three.js clears the counters at the top of every `render`, and the overlay pass calls
    // `render` a second time — left automatic, a frame would report the trihedron alone.
    renderer.info.autoReset = false
    this.renderer = renderer

    if (this.options.controls !== 'none') {
      this.controls = new OrbitControls(this.camera, canvas)
      this.controls.enableDamping = true
      this.controls.addEventListener('change', this.requestRender)
      // On `end` rather than on `change`: the latter fires per frame of an orbit, and whoever
      // listens here publishes into a store. Once the hand lets go is when the framing is a
      // decision rather than a gesture in progress.
      const settled = this.options.onCameraSettled
      if (settled) this.controls.addEventListener('end', () => settled(0))
    }

    canvas.addEventListener('pointerdown', this.armPaneUnderPointer)
    canvas.addEventListener('pointermove', this.armPaneUnderPointer)

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

    while (this.extras.length > 0) this.disposeExtra()

    const canvas = this.renderer?.domElement
    canvas?.removeEventListener('pointerdown', this.armPaneUnderPointer)
    canvas?.removeEventListener('pointermove', this.armPaneUnderPointer)
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
    if (this.perspective.fov === degrees) return
    this.perspective.fov = degrees
    this.perspective.updateProjectionMatrix()
    // The orthographic frustum is derived from the field of view, so it moves with it.
    this.fitProjection()
    this.requestRender()
  }

  /**
   * Where a pointer sits in device coordinates, or `null` if the canvas has no surface yet.
   *
   * Relative to the PANE under it, not to the canvas: a ray cast from a quarter-sized view with
   * whole-canvas coordinates lands somewhere the pointer never was.
   */
  pointerNdcOf(pointer: PointerPosition): { x: number; y: number } | null {
    const canvas = this.renderer?.domElement
    if (!canvas) return null

    const bounds = canvas.getBoundingClientRect()
    const pane = this.rects[this.paneAtPointer(pointer) ?? 0]
    if (!pane) return pointerNdc(pointer, bounds)

    return pointerNdc(pointer, {
      left: bounds.left + pane.x,
      top: bounds.top + pane.y,
      width: pane.width,
      height: pane.height,
    })
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
    // The main camera follows its own pane, not the canvas: in a quad layout that is a quarter
    // of it, and an aspect taken from the whole surface stretches every one of the four. Both
    // sides of the ratio are non-zero — the guard above turned back a surface with no height.
    const main = this.layOutPanes()
    this.perspective.aspect = main.width / main.height
    this.perspective.updateProjectionMatrix()
    this.fitProjection()
    this.requestRender()
  }

  /**
   * One render in a single layout, four scissored ones in a quad — never four contexts.
   *
   * A second WebGL context per view would quadruple what the machine holds for a view that shows
   * the same scene, and a consumer GPU drops the oldest context when it runs out. The scissor is
   * what keeps a pane from clearing the three beside it.
   */
  private renderPanes(renderer: WebGLRenderer): void {
    if (this.extras.length === 0) {
      this.options.onPane?.(0, this.camera)
      renderer.render(this.scene, this.camera)
      return
    }

    const height = renderer.domElement.clientHeight

    renderer.setScissorTest(true)
    try {
      // Walked by index rather than over `paneCameras`: that getter builds an array, and one
      // built per frame is one allocation per frame for a list of four that never changes.
      for (const [index, rect] of this.rects.entries()) {
        const camera = this.cameraOfPane(index)
        if (!camera) continue

        const { x, y, width, height: paneHeight } = glRect(rect, height)
        renderer.setViewport(x, y, width, paneHeight)
        renderer.setScissor(x, y, width, paneHeight)
        this.options.onPane?.(index, camera)
        renderer.render(this.scene, camera)
      }
    } finally {
      // In a `finally`, and both of them: a throw mid-pane would otherwise leave every later
      // frame — overlay included — clipped to whichever quarter failed.
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, renderer.domElement.clientWidth, height)
    }
  }

  /**
   * The camera preview, drawn over the panes in its own scissored rectangle.
   *
   * A pass rather than a fifth pane, and a pass rather than a second context: it covers what is
   * already drawn instead of dividing the surface, and a context per preview is what
   * `scene-stage` pays elsewhere and says why. The cost is one more `render` per frame, on a
   * rectangle a quarter as wide — and the loop still sleeps when nothing moves.
   */
  /** Whether the preview leaves nothing of the panes to see — its grown state, in practice. */
  private insetCoversAll(renderer: WebGLRenderer): boolean {
    const rect = this.inset?.rect
    if (!rect) return false

    const canvas = renderer.domElement
    return (
      rect.x <= 0 &&
      rect.y <= 0 &&
      rect.width >= canvas.clientWidth &&
      rect.height >= canvas.clientHeight
    )
  }

  private renderInset(renderer: WebGLRenderer): void {
    const inset = this.inset
    if (!inset) return

    const height = renderer.domElement.clientHeight
    const gl = glRect(inset.rect, height)
    const restore = this.options.onInset?.()

    renderer.setScissorTest(true)
    try {
      renderer.setViewport(gl.x, gl.y, gl.width, gl.height)
      renderer.setScissor(gl.x, gl.y, gl.width, gl.height)
      inset.camera.aspect = inset.rect.width / inset.rect.height
      inset.camera.updateProjectionMatrix()
      renderer.render(this.scene, inset.camera)
    } finally {
      // Every one of them in a `finally`, as `renderPanes` does: a throw here would otherwise
      // leave the workshop hidden and every later frame clipped to this corner.
      restore?.()
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, renderer.domElement.clientWidth, height)
    }
  }

  /**
   * On demand, not on a permanent loop: a studio whose viewport burns a frame at rest heats the
   * machine for nothing. The loop keeps going only while something is actually moving.
   */
  private readonly renderFrame = (): void => {
    this.frame = null
    const renderer = this.renderer
    if (!renderer) return

    // The engine clears, not three.js — see `autoReset` at mount.
    renderer.info.reset()

    const now = performance.now()
    const delta = frameDelta({
      since: this.lastTime === null ? null : now - this.lastTime,
      cap: MAX_DELTA,
    })
    this.lastTime = now

    const moving = this.options.onFrame?.(delta) ?? false

    // `update` reports whether the camera actually moved: it keeps returning true while damping
    // settles, and false once it has — which is what ends the loop instead of running forever.
    // Every pane is asked: the one being dragged is not always the one that is still settling.
    // Walked field by field rather than over `paneOrbits`, which would allocate a list per frame.
    let settling = this.controls?.enabled === true && this.controls.update()
    for (const pane of this.extras) {
      if (pane.controls?.enabled === true && pane.controls.update()) settling = true
    }

    // The panes are skipped when the preview covers them whole: drawing a scene twice over to
    // throw the first one away is the most expensive thing a frame can do.
    if (!this.insetCoversAll(renderer)) this.renderPanes(renderer)
    // After the panes and before the overlay: the preview covers the view it sits on, and the
    // trihedron stays on top of both.
    this.renderInset(renderer)

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

    // Read per frame, never cached: a context restore replaces `info` and its two counter objects.
    recordFrame(renderer.info, this.stats)

    if (moving || settling) {
      this.requestRender()
      return
    }

    // The loop stops here, so the clock goes back to rest: without this every caller that starts
    // an animation would have to call `resetClock` itself, and the one that forgot would open its
    // motion on a `MAX_DELTA` jump.
    this.lastTime = null
  }
}
