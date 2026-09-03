import {
  ACESFilmicToneMapping,
  Color,
  LinearSRGBColorSpace,
  MeshBasicMaterial,
  NoToneMapping,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createGpuPipeline, type GpuPipeline } from '../gpu/gpuPipeline'
import { token } from '../core/palette'
import { aspectLoan } from './aspectLoan'
import { dollyTo, dragNotchesOf } from './dolly'
import { pinchReading, type PinchReading } from './pinch'
import { gestureOf, type Gesture } from './gestures'
import { SCHEME_OF, type NavigationScheme } from '@shared/domain/navigationPreset'
import { orbitAround } from './orbit'
import { gazeTargetOf, type PivotMode } from './orbitPivot'
import { panBy } from './pan'
import { frameDelta } from './frameClock'
import { emptyGpuStats, recordFrame, type GpuStats } from './gpuStats'
import { createGpuTimer, isGpuTimerContext, type GpuTimer } from './gpuTimer'
import {
  glRect,
  inRect,
  intoGlRect,
  paneAt,
  paneCount,
  paneRects,
  type PaneLayout,
  type PaneRect,
} from './panes'
import { pointerNdc, type PointerPosition } from './pointer'
import { frustumHeight } from './screenScale'
import { ViewportNavigationTarget } from './ViewportNavigationTarget'

/** A two-finger gesture in flight: its last two readings, and the pane it belongs to. */
type Pinch = PinchReading & { pane: number; moved: boolean }

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
   * it, and answering whether that changed what the scene wears — which is what tells the frame
   * its shadow maps are worth drawing again. The one seam that makes a per-view display mode
   * possible: `overrideMaterial` and a camera's layers are read at render time, so a pane's
   * answer only has to hold for its own pass.
   */
  onPane?: (index: number, camera: ViewportCamera) => boolean
  /**
   * Called around the inset pass, and it hands back the call that undoes whatever it did.
   *
   * The seam a preview needs and `onPane` cannot give: a preview shows what the camera FILMS, so
   * the grid and the helpers have to be hidden for that pass and put back for the next — and
   * `onPane` has no symmetrical call after a pane is drawn.
   */
  onInset?: (camera: ViewportCamera) => () => void
  /** Narrows a requested shadow pass, then restores the scene for off-screen renders. */
  onShadowFrame?: (refreshAll: boolean) => () => void
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
  /**
   * Called once the pointer has settled which pane is being worked in, and BEFORE any listener of
   * the canvas sees that same event — this runs in the capture phase, on the host.
   *
   * The seam a control that reads its own pointer events needs, `TransformControls` being the one
   * that does: it casts from the camera it is holding at that instant, so whoever hands it that
   * camera has to run first. Left to the caller's own listener, the order would rest on which of
   * the two `mount` calls came first, and nothing would guard it.
   */
  onPaneArmed?: (event: PointerEvent) => void
  /**
   * What the wheel's ray may land the pivot on. Without it the ray would take the grid, a light's
   * helper or the gizmo for scenery, and none of those is a place to aim at.
   */
  pickTargets?: () => Object3D[]
  /**
   * A first refusal on the wheel, for a caller the notches mean something else to — flying, where
   * they set the speed. `true` consumes the event and no dolly happens.
   */
  onWheel?: (event: WheelEvent) => boolean
  /**
   * Centre of what the caller has selected, in world space, or `null` where nothing is. Where the
   * gizmo sits, and what Blender turns around under the name *Orbit Around Selection*.
   */
  selectionCentre?: () => Vector3 | null
  /** The two navigation preferences the pivot cascade reads — see `orbitPivot`. */
  pivotMode?: () => PivotMode
  /** Which application's gestures the buttons answer to — see `navigationPreset`. */
  scheme?: () => NavigationScheme
  /**
   * Draws the scene the way its owner COMPOSES it, and answers whether it drew anything.
   *
   * The one seam through which the viewport, every camera preview and every off-screen render
   * reach the same code — without this engine learning what a post-processing stack is, which is
   * the same line it holds against gizmos and outliners. `false` means « nothing composed », and
   * the plain render happens here.
   */
  onDraw?: (request: DrawRequest) => boolean
  fieldOfView?: number
  near?: number
  far?: number
}

/**
 * Which surface is being drawn, so its owner can answer with the composition that belongs to it:
 * a pane films through the SCENE's, a preview through its camera's, and an off-screen render
 * through whichever camera the film is on at that instant.
 */
export type DrawSurface = 'pane' | 'inset' | 'offscreen'

/**
 * One request to draw the scene somewhere. Sizes are in DEVICE pixels — an effect that reads a
 * resolution reads the one it is actually drawing at, never a CSS measure.
 */
export type DrawRequest = {
  scene: Scene
  camera: ViewportCamera
  surface: DrawSurface
  /** Which pane, for a `pane` request. Zero everywhere else. */
  paneIndex: number
  /**
   * Which node of the document the camera belongs to, when it is one — a preview and an
   * off-screen render film through a camera the document holds, and what that camera composes
   * with lives on the node. `null` for a pane, which looks through the workshop's own.
   */
  cameraNodeId: string | null
  /** `null` is the canvas. */
  target: WebGLRenderTarget | null
  /** Where on the canvas, when only part of it is being drawn. Absent means all of it. */
  rect: PaneRect | null
  width: number
  height: number
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
/** Frames measured after one read: enough to cover a reader polling a few times a second. */
const GPU_TIMED_FRAMES = 30

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
  /** Which node of the document that camera IS — what its owner resolves a composition by. */
  cameraNodeId: string | null
  /** In CSS pixels, origin top-left, like every other pane rect. */
  rect: PaneRect
  /**
   * What the preview is cleared to before it draws. A scene with no background of its own is
   * TRANSPARENT, and the panes underneath then showed straight through the picture — a preview
   * one reads the viewport through is not a preview.
   */
  backdrop: Color
  /**
   * Grown to the whole view, which is what lets the panes under it be skipped.
   *
   * Told rather than measured. The rectangle handed over is the INSIDE of the DOM frame, so it
   * is two pixels short of the canvas on every side — a comparison against the canvas therefore
   * answered "no" at every size, and the panes went on being drawn under a picture that hid
   * them whole.
   */
  full: boolean
}

/**
 * How often the preview is redrawn while what it shows keeps changing — a corner monitor at
 * 30 Hz beside a view at 120 reads as live, and costs a quarter as much.
 *
 * A CAP, never a clock: a preview whose content has not moved is not redrawn at all.
 */
export const INSET_CADENCE_MS = 1000 / 30

/** What composites the cached preview: the studio's own full-frame quad, wearing its texture. */
type InsetBlit = { quad: GpuPipeline; material: MeshBasicMaterial }

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

/** Reused, so lending allocates nothing. How FAR ahead is `PIVOT_AHEAD`, the one such distance. */
const borrowedAim = new Vector3()

/**
 * Whether `OrbitControls` still owns the gestures of the camera it holds — see `armOrbits`.
 *
 * Disabled, its TOUCH handlers go with it: what a perspective pane does with fingers is read by
 * `navigateByTouch` instead — one turns, two pan and dolly.
 */
function ownsGestures(controls: OrbitControls): boolean {
  return controls.object instanceof OrthographicCamera
}

/** The same three flags a caller already sets to lock a view down — see `viewFrom`. */
function allows(orbit: OrbitControls, kind: Gesture): boolean {
  if (kind === 'orbit') return orbit.enableRotate
  if (kind === 'pan') return orbit.enablePan
  return orbit.enableZoom
}

/**
 * Puts a pivot back on the line of sight, keeping the depth it had. What every surface that
 * hands its gestures back to `OrbitControls` has to do first — see `settleOrbit`.
 */
function aimPivotAhead(camera: ViewportCamera, pivot: Vector3): void {
  pivot.copy(gazeTargetOf(camera.position, camera.getWorldDirection(borrowedAim), pivot))
}

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
  private readonly navigationTarget: ViewportNavigationTarget
  /**
   * The navigation gesture the pointer holds, or `null`. One at a time, and only ever started on
   * a perspective pane — an orthographic one keeps every gesture `OrbitControls` gives it.
   */
  private drag: {
    readonly kind: Gesture
    readonly pane: number
    readonly pointerId: number
    /** The button that NAMED the gesture. A mouse gives every button one `pointerId`. */
    readonly button: number
    clientX: number
    clientY: number
    /** Where the press was, the pivot being decided from THERE at the first move — see `onNavigate`. */
    pressedAt: PointerPosition | null
    /** Whether a pixel was actually travelled, so a click that never moved publishes nothing. */
    moved: boolean
  } | null = null
  /** The fingers on the surface, written in place: a touch move arrives as often as a mouse one,
   * and a fresh object per move is garbage per move. */
  private readonly touches = new Map<number, PointerPosition>()
  /** Apart from `drag`, which follows ONE `pointerId` and would steer by whichever hand moved. */
  private pinch: Pinch | null = null
  private output: ViewportOutput = {}
  private controls: OrbitControls | null = null
  private observer: ResizeObserver | null = null
  private layout: PaneLayout = 'single'
  /** Pane 0 until a pointer says otherwise, which is the only pane a single layout has. */
  private active = 0
  /** Whether another gesture holds the pointer — see `freezePanes`. */
  private frozen = false
  /** Which pane navigation answers in, or `null` where none does — see `armOrbits`. */
  private armedPane: number | null = 0
  /**
   * Where the pointer last was, kept even while frozen so thawing can re-arm from it. Written in
   * place: this takes every pointer move, and a fresh object per move is garbage per move.
   */
  private readonly lastPointer: PointerPosition = { clientX: 0, clientY: 0 }
  /** Kept so the listeners posted on it at mount come off at dispose. */
  private host: HTMLElement | null = null
  /**
   * The views beside the main one, which is always pane 0 and always the one that was already
   * there. Empty in a single layout, so every viewport that never asks for four draws exactly
   * what it drew before — one camera, one render, no scissor.
   */
  private readonly extras: ExtraPane[] = []
  /** Where each pane sits, in CSS pixels. One entry in a single layout, four in a quad. */
  private rects: PaneRect[] = []
  /** What `activePaneRegion` answers with, rewritten in place — see the note there. */
  private readonly activeRegion: PaneRect = { x: 0, y: 0, width: 0, height: 0 }
  /** What the camera preview shows, or `null` when it is closed. */
  private inset: InsetPane | null = null
  /** Where the preview was last drawn, kept so a frame that changed nothing only composites it. */
  private insetHeld: WebGLRenderTarget | null = null
  private insetBlit: InsetBlit | null = null
  /**
   * Whether what the preview shows has moved since it was last drawn.
   *
   * Open by default and closed only by a draw: the cost of one preview too many is a frame, and
   * the cost of one too few is a monitor showing the wrong instant.
   */
  private insetStale = true
  /** Before any clock there is, so the FIRST preview is never the one the cadence holds back. */
  private insetDrawnAt = Number.NEGATIVE_INFINITY
  /** The wake that redraws a preview the cap held back, so the last change is never dropped. */
  private insetCatchUp: ReturnType<typeof setTimeout> | null = null
  /** Read back once per drawn preview rather than allocated — this sits on the frame path. */
  private readonly insetClear = new Color()
  /** How tall the added views see, in world units. Set by whoever knows what the scene holds. */
  private extraHeight = EXTRA_PANE_HEIGHT
  private frame: number | null = null
  /** `null` while the loop is at rest: the next frame is a first frame, not a long one. */
  private lastTime: number | null = null
  /** What the last drawn frame cost, and what the context holds. `frames` standing still is a
   * viewport that went back to sleep, which is what the loop is meant to do. */
  readonly stats: GpuStats = emptyGpuStats()
  private gpuTimer: GpuTimer | null = null
  /**
   * Frames still owed a GPU measurement. A timer query is not free — it is asked for only while
   * somebody reads the figure, and `wantsGpuTiming` re-arms it on every read.
   */
  private gpuFramesWanted = 0

  /** Asks for the GPU time of the next few frames. Called by whoever is about to show it. */
  readonly wantsGpuTiming = (): void => {
    this.gpuFramesWanted = GPU_TIMED_FRAMES
  }

  constructor(private readonly options: ViewportEngineOptions = {}) {
    this.perspective = new PerspectiveCamera(
      options.fieldOfView ?? 60,
      1,
      options.near ?? 0.1,
      options.far ?? 1000,
    )
    this.orthographic.near = options.near ?? 0.1
    this.orthographic.far = options.far ?? 1000
    this.navigationTarget = new ViewportNavigationTarget({
      pointerNdc: at => this.pointerNdcOf(at),
      pickTargets: () => this.options.pickTargets?.() ?? [],
      selectionCentre: () => this.options.selectionCentre?.() ?? null,
      pivotMode: () => this.options.pivotMode?.(),
      requestRender: this.requestCameraRender,
      onSettled: pane => this.options.onCameraSettled?.(pane),
    })
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

    // An orthographic pane hands every gesture back to `OrbitControls`, and its `update()` runs
    // again — see `settleOrbit`. A pivot left where the pointer named it would swing the view on
    // the very first frame after the swap.
    if (kind === 'orthographic' && this.controls) aimPivotAhead(next, this.controls.target)

    this.fitProjection()
    if (this.controls) this.controls.object = next
    this.armOrbits(this.armedPane)
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
    const height = frustumHeight(this.perspective.fov, distance)
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

  /**
   * Takes the views out of the pointer's hands for the length of another gesture — a gizmo handle
   * held, a camera flying — and gives them back.
   *
   * EVERY orbit, and the active pane with them: `armPaneUnderPointer` re-arms on every move, so a
   * caller that turned one orbit off itself would find it back on at the next pixel of that very
   * drag — the scene orbited under a handle being pulled. Frozen, the working view cannot change
   * mid-drag either, which is what stops a pointer straying into a neighbouring pane from handing
   * the gizmo another camera halfway through.
   */
  freezePanes(frozen: boolean): void {
    // On the TRANSITION, never on every call: this is read back on each pointer move, and
    // `paneAtPointer` measures the canvas — a second reflow per move for an answer already known.
    const thawing = this.frozen && !frozen
    this.frozen = frozen
    // Thawing re-arms from where the pointer IS: the move that lifts a freeze is the very one
    // `armPaneUnderPointer` returned early on, so reading `active` alone leaves the working view
    // — and the camera a gizmo grabs from — one event behind. `null` off the surface.
    if (thawing) this.active = this.paneAtPointer(this.lastPointer) ?? this.active

    this.armOrbits(frozen ? null : this.active)
  }

  /**
   * Hands the navigation to one pane and takes it from every other. `null` leaves all of them
   * off, which is both a frozen viewport and a pointer that has left the surface.
   *
   * `OrbitControls.enabled` is NOT that flag: it says whether the control still owns the
   * gestures, which it does on an orthographic pane only. It calls `update()` from its own move
   * handlers, so refusing it the pointer is the one way to stop it re-aiming at its target.
   */
  private armOrbits(owner: number | null): void {
    // A single layout keeps `active` at 0, so the main orbit reads the same test as the others.
    this.armedPane = owner
    if (this.controls) this.controls.enabled = owner === 0 && ownsGestures(this.controls)
    for (const [index, pane] of this.extras.entries()) {
      if (pane.controls) pane.controls.enabled = owner === index + 1 && ownsGestures(pane.controls)
    }
  }

  /**
   * Where the active pane sits, in the frame a control that reads raw pointer events needs: CSS
   * pixels, origin bottom-left. `null` in a single layout, where the pane IS the canvas.
   */
  activePaneRegion(): PaneRect | null {
    const canvas = this.renderer?.domElement
    const rect = this.rects[this.active]
    if (this.layout === 'single' || !canvas || !rect) return null

    // Into a rect of its own: a caller aiming a control reads this on every pointer move, and the
    // answer is four numbers. The reference is handed out, so nobody may hold on to it.
    return intoGlRect(rect, canvas.clientHeight, this.activeRegion)
  }

  /**
   * Where a pointer sits ON the canvas, in CSS pixels from its top-left corner — the frame a DOM
   * overlay laid over the same box measures in. `null` while there is no surface.
   */
  canvasPointOf(pointer: PointerPosition): { x: number; y: number } | null {
    const canvas = this.renderer?.domElement
    if (!canvas) return null

    const bounds = canvas.getBoundingClientRect()
    return { x: pointer.clientX - bounds.left, y: pointer.clientY - bounds.top }
  }

  /** Which pane a pointer is over, or `null` when it is off the surface entirely. */
  paneAtPointer(pointer: PointerPosition): number | null {
    const at = this.canvasPointOf(pointer)
    if (!at) return null

    // The inset first, and it answers for nobody: it covers a pane rather than dividing the
    // surface, so without this a drag inside the preview would orbit the view underneath it.
    if (this.insetHasPointer(pointer)) return null
    return paneAt(this.rects, at.x, at.y)
  }

  /**
   * Whether a pointer landed in the camera preview. What a picker asks before casting a ray: the
   * preview draws through a camera of its own, so a ray cast from the pane underneath would meet
   * whatever stands behind the picture rather than what is in it.
   */
  insetHasPointer(pointer: PointerPosition): boolean {
    const inset = this.inset
    if (!inset) return false

    const at = this.canvasPointOf(pointer)
    return at !== null && inRect(inset.rect, at.x, at.y)
  }

  /**
   * What the preview shows, and where — `null` closes it.
   *
   * The rect comes from the caller because the DOM chrome around the preview has to land on the
   * very same pixels: one rectangle, decided once, rather than two that agree until they drift.
   */
  setInsetPane(pane: InsetPane | null): void {
    this.inset = pane
    this.invalidateInset()
    this.requestRender()
  }

  /**
   * Says that what the preview SHOWS has changed — as opposed to `requestRender`, which says the
   * canvas has to be painted again.
   *
   * The two are not the same question, and that is the whole gain: orbiting, flying and settling
   * move the view without moving one thing a scene camera films, and those frames now composite
   * a picture already drawn instead of walking the scene a second time. Measured on a scene of
   * 1 504 nodes: the second pass cost 5,1 ms of CPU for 0,38 ms of GPU.
   *
   * Whoever owns the scene calls this — `SceneRenderer.redraw` does both at once, and a guard
   * holds it to that, because a missed call shows the wrong instant while a spare one costs a
   * single frame.
   */
  invalidateInset(): void {
    this.insetStale = true
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
    controls.addEventListener('change', this.requestCameraRender)
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
      // Both ways round, a lent camera and one handed back: `update()` ends on `lookAt(target)`,
      // so a target left where the pane last turned swings that camera the moment it changes hands.
      aimPivotAhead(drawn, pane.controls.target)
      this.armOrbits(this.armedPane)
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
    if (pane.controls) {
      // The two `setProjection` makes for pane 0, and for the same reason: an orthographic pane
      // takes its gestures back, and `update()` would swing it round a pivot left off the axis.
      if (kind === 'orthographic') aimPivotAhead(next, pane.controls.target)
      pane.controls.object = next
      this.armOrbits(this.armedPane)
    }

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
    // A pointer that moved aims somewhere else, whatever else this call decides.
    this.navigationTarget.invalidate()

    // Kept before the early return, never after: the move that lifts a freeze is one this
    // returns on, and `freezePanes` has nothing to re-arm from unless that move was recorded.
    this.lastPointer.clientX = event.clientX
    this.lastPointer.clientY = event.clientY

    // `this.drag` beside the freeze: a navigation gesture holds the pointer just as a handle does,
    // and the pane under it must not change halfway — the wheel would then act on another view.
    if (this.layout !== 'single' && !this.frozen && !this.drag) {
      const over = this.paneAtPointer(event)
      if (over !== null) this.active = over
      this.armOrbits(over)
    }

    // Outside the guard above, and that is the point: a caller that thaws does it from here, and
    // it would never get the chance if a frozen viewport returned before saying anything.
    this.options.onPaneArmed?.(event)
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

      // A borrowed camera too: one of the scene is built square, and a 1:1 frustum drawn into a
      // quarter of a wide canvas stretches everything it shows.
      if (pane.borrowed) {
        pane.borrowed.aspect = aspect
        pane.borrowed.updateProjectionMatrix()
      }
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
    // Drawn when this engine says so, never per frame: `requestRender` is what says a shadow
    // could have moved, and a camera frame goes through `requestCameraRender` instead. Stale
    // from here, so a context rebuilt under a mounted engine draws its maps on the first frame
    // rather than showing a scene with no shadows until something else moves.
    renderer.shadowMap.autoUpdate = false
    this.shadowsStale = true
    this.allShadowsStale = true
    // three.js clears the counters at the top of every `render`, and the overlay pass calls
    // `render` a second time — left automatic, a frame would report the trihedron alone.
    renderer.info.autoReset = false
    this.renderer = renderer
    const context = renderer.getContext()
    this.gpuTimer = isGpuTimerContext(context) ? createGpuTimer(context) : null

    if (this.options.controls !== 'none') {
      this.controls = new OrbitControls(this.camera, canvas)
      this.controls.enableDamping = true
      this.controls.addEventListener('change', this.requestCameraRender)
      // On `end` rather than on `change`: the latter fires per frame of an orbit, and whoever
      // listens here publishes into a store. Once the hand lets go is when the framing is a
      // decision rather than a gesture in progress.
      const settled = this.options.onCameraSettled
      if (settled) this.controls.addEventListener('end', () => settled(0))
    }

    // Capture, and on the HOST rather than the canvas: a capture on an ancestor runs ahead of
    // every listener of the canvas whatever order those were added in — and `TransformControls`
    // is one of them, grabbing from whichever camera it holds when it reads the event.
    this.host = host
    host.addEventListener('pointerdown', this.armPaneUnderPointer, true)
    host.addEventListener('pointermove', this.armPaneUnderPointer, true)
    // After the arming, never before: it settles which pane is worked in, and this reads that.
    host.addEventListener('pointerdown', this.onNavigate, true)
    // The rest of the gesture on the WINDOW, and no pointer capture at all: a drag straying off
    // the panel must go on turning, and `TransformControls` grabs the very same canvas — a
    // capture taken here is one taken from IT, and released under a handle still being pulled.
    window.addEventListener('pointermove', this.onNavigate, true)
    window.addEventListener('pointerup', this.onNavigateRelease, true)
    // A finger the browser takes back — a scroll gesture, a system edge swipe — sends this and
    // never a `pointerup`, and the pair it belonged to would go on steering the view.
    window.addEventListener('pointercancel', this.onNavigateRelease, true)
    // Not passive: the dolly cancels the event, and a passive listener may not. On the host for
    // the reason above — `OrbitControls` posts its own wheel listener on the canvas.
    host.addEventListener('wheel', this.onWheelCapture, { capture: true, passive: false })

    // Drawn in the turn it is measured, never asked for: `setSize` blanks the drawing buffer, and
    // an observation lands after the frame callbacks of the paint that follows — see
    // `followHostSize`, which refuses the same frame of lag on the Pixi side.
    this.observer = new ResizeObserver(() => {
      if (this.onResize()) this.drawPendingFrame()
    })
    this.observer.observe(canvas)
    // `OrbitControls` is born enabled, on a camera it may not own — see `armOrbits`.
    this.armOrbits(this.armedPane)
    // Not drawn: the engine that owns this one is still building, and `onFrame` would run on it.
    this.onResize()
  }

  dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null

    this.observer?.disconnect()
    this.observer = null

    this.controls?.removeEventListener('change', this.requestCameraRender)
    this.controls?.dispose()
    this.controls = null

    while (this.extras.length > 0) this.disposeExtra()

    this.host?.removeEventListener('pointerdown', this.armPaneUnderPointer, true)
    this.host?.removeEventListener('pointermove', this.armPaneUnderPointer, true)
    this.host?.removeEventListener('pointerdown', this.onNavigate, true)
    window.removeEventListener('pointermove', this.onNavigate, true)
    window.removeEventListener('pointerup', this.onNavigateRelease, true)
    window.removeEventListener('pointercancel', this.onNavigateRelease, true)
    // Cleared like the wheel's own registers: a drag left set is one the next mount resumes
    // from coordinates a panel ago, and the camera jumps on the first move.
    this.drag = null
    this.pinch = null
    this.touches.clear()
    this.host?.removeEventListener('wheel', this.onWheelCapture, true)
    this.host = null

    this.navigationTarget.dispose()

    if (this.insetCatchUp !== null) clearTimeout(this.insetCatchUp)
    this.insetCatchUp = null
    this.disposeInset()

    const canvas = this.renderer?.domElement
    this.renderer?.forceContextLoss()
    this.renderer?.dispose()
    this.renderer = null
    this.gpuTimer = null

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
    // What stands behind the objects is part of what a scene camera films, so the preview is as
    // out of date as the panes are.
    this.invalidateInset()
    this.requestRender()
  }

  /**
   * How many device pixels one CSS pixel buys. The single lever a quality setting pulls: nothing
   * about the assets moves, only how finely the same frame is drawn.
   *
   * Held to the screen's own ratio at the top — asking for more than the display has is paying
   * for pixels nobody can see.
   */
  setPixelRatio(ratio: number): void {
    const renderer = this.renderer
    if (!renderer) return

    const wanted = Math.min(ratio, window.devicePixelRatio)
    if (renderer.getPixelRatio() === wanted) return

    renderer.setPixelRatio(wanted)
    // The drawing buffer is sized from the ratio, so it has to be laid out again — `setSize`
    // multiplies by the ratio it finds at the moment it runs.
    this.onResize()
    this.invalidateInset()
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
   * whole-canvas coordinates lands somewhere the pointer never was. `inPane` pins that pane —
   * what a gesture that started in one and travelled out of it has to measure against.
   */
  pointerNdcOf(pointer: PointerPosition, inPane?: number): { x: number; y: number } | null {
    const canvas = this.renderer?.domElement
    if (!canvas) return null

    const bounds = canvas.getBoundingClientRect()
    const pane = this.rects[inPane ?? this.paneAtPointer(pointer) ?? 0]
    if (!pane) return pointerNdc(pointer, bounds)

    return pointerNdc(pointer, {
      left: bounds.left + pane.x,
      top: bounds.top + pane.y,
      width: pane.width,
      height: pane.height,
    })
  }

  /** Pane 0 is the main orbit; the rest read one past their own index, as the cameras do. */
  private orbitOfPane(index: number): OrbitControls | null {
    return index === 0 ? this.controls : (this.extras[index - 1]?.controls ?? null)
  }

  /** The wheel, taken from `OrbitControls` for perspective panes — why, in `dolly.ts`. */
  private readonly onWheelCapture = (event: WheelEvent): void => {
    if (this.options.onWheel?.(event) === true) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const index = this.paneAtPointer(event)
    if (index === null) return

    const camera = this.cameraOfPane(index)
    const orbit = this.orbitOfPane(index)
    // An orthographic pane keeps the wheel `OrbitControls` gives it: it shows the same thing
    // wherever it stands, so it zooms by scaling its frustum. Its `zoomToCursor` is NOT the way to
    // anchor it — that one reads the whole canvas, so it drifts in every pane of a quad layout.
    if (!(camera instanceof PerspectiveCamera) || !orbit || this.armedPane !== index) return

    if (!this.navigationTarget.wheel(event, index, camera, orbit)) return

    event.preventDefault()
    event.stopPropagation()
  }

  /**
   * The drag, taken from `OrbitControls` for the reason `orbit.ts` carries. Registered AFTER
   * `armPaneUnderPointer`, which settles which pane is worked in before this reads it.
   */
  private readonly onNavigate = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return this.navigateByTouch(event)
    // 🛑 A press is read even while a drag runs: a chord that ADDS a button to one already down —
    // `rightOntoLeft`, which the settings screen offers — arrives as a `pointerdown` mid-drag, and
    // handed straight to `dragBy` it never reached `gestureOf`. That dolly could not fire at all.
    if (event.type !== 'pointerdown') return this.dragBy(event)

    const kind = gestureOf(event, this.options.scheme?.() ?? SCHEME_OF.studio)
    if (kind === null) return this.dragBy(event)

    const index = this.paneAtPointer(event)
    if (index === null || !this.takesDrag(kind, index)) return this.dragBy(event)

    // The chord that answered wins over the one running: the second button is what the hand just
    // asked for, and two drags cannot steer one camera.
    this.endDrag()
    this.startDrag(kind, index, event.pointerId, event.button, event)
  }

  /** Whether that pane answers that gesture at all. Perspective only, exactly as the wheel: an
   * orthographic pane keeps every gesture `OrbitControls` gives it. */
  private takesDrag(kind: Gesture, pane: number): boolean {
    const camera = this.cameraOfPane(pane)
    const orbit = this.orbitOfPane(pane)
    if (!(camera instanceof PerspectiveCamera) || !orbit || this.armedPane !== pane) return false

    return allows(orbit, kind)
  }

  /** The pivot is NOT laid here: the capture listener that calls this runs ahead of the gizmo,
   * which may grab its handle on this very press — it is decided at the first move. */
  private startDrag(
    kind: Gesture,
    pane: number,
    pointerId: number,
    button: number,
    at: PointerPosition,
  ): void {
    this.drag = {
      kind,
      pane,
      pointerId,
      button,
      clientX: at.clientX,
      clientY: at.clientY,
      pressedAt: { clientX: at.clientX, clientY: at.clientY },
      moved: false,
    }
  }

  /** What fingers do, which no scheme spells: a touch surface has no buttons to build a chord
   * from, so one turns the view and two pan and dolly it. */
  private navigateByTouch(event: PointerEvent): void {
    if (event.type === 'pointerdown') return this.addFinger(event)

    const held = this.touches.get(event.pointerId)
    if (!held) return
    held.clientX = event.clientX
    held.clientY = event.clientY

    if (this.pinch) this.pinchBy(this.pinch)
    else this.dragBy(event)
  }

  private addFinger(event: PointerEvent): void {
    const pane = this.paneAtPointer(event)
    if (pane === null) return

    this.touches.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    const two = this.twoFingers()
    if (!two) {
      if (this.takesDrag('orbit', pane)) this.startDrag('orbit', pane, event.pointerId, 0, event)
      return
    }

    // The one-finger turn is over the moment a second lands: kept, it would go on turning by
    // whichever finger happened to move, on top of the pan the pair is asking for.
    this.endDrag()
    this.pinch = { pane, ...pinchReading(two), moved: false }
  }

  /** The first two fingers down, handed over as the map holds them — `null` while there is one. */
  private twoFingers(): [PointerPosition, PointerPosition] | null {
    const [first, second] = this.touches.values()
    return first && second ? [first, second] : null
  }

  /** Both at once, as every touch surface does them: the middle pans, the gap dollies. */
  private pinchBy(pinch: Pinch): void {
    const two = this.twoFingers()
    const camera = this.cameraOfPane(pinch.pane)
    const orbit = this.orbitOfPane(pinch.pane)
    if (!two || !(camera instanceof PerspectiveCamera) || !orbit) return
    if (this.armedPane !== pinch.pane) return this.endPinch()

    const height = this.rects[pinch.pane]?.height ?? 0
    if (height === 0) return

    const { gap, middleX, middleY } = pinchReading(two)
    pinch.moved = true

    if (orbit.enablePan) {
      this.applyGesture(
        'pan',
        camera,
        orbit,
        middleX - pinch.middleX,
        middleY - pinch.middleY,
        height,
      )
    }
    // Spreading closes in, as it does everywhere: a gap that grew is a positive delta, which is
    // what `dragNotchesOf` reads as travelling right.
    if (orbit.enableZoom) this.applyGesture('dolly', camera, orbit, gap - pinch.gap, 0, height)

    pinch.gap = gap
    pinch.middleX = middleX
    pinch.middleY = middleY
  }

  private endPinch(): void {
    const pinch = this.pinch
    this.pinch = null
    if (pinch?.moved) this.options.onCameraSettled?.(pinch.pane)
  }

  private releaseTouch(event: PointerEvent): void {
    this.touches.delete(event.pointerId)
    if (!this.pinch) {
      if (this.drag?.pointerId === event.pointerId) this.endDrag()
      return
    }

    const pane = this.pinch.pane
    this.endPinch()
    // Three fingers down and one lifted still leaves a PAIR: read as a single finger, the pinch
    // died and the pan came back only once every finger had left the glass.
    const two = this.twoFingers()
    if (two) {
      this.pinch = { pane, ...pinchReading(two), moved: false }
      return
    }

    // The finger still down takes the view back, anchored where it IS: resumed from where the
    // pair began, the view would jump the whole way the two of them travelled.
    const [id, at] = this.touches.entries().next().value ?? []
    if (id !== undefined && at && this.takesDrag('orbit', pane)) {
      this.startDrag('orbit', pane, id, 0, at)
    }
  }

  private dragBy(event: PointerEvent): void {
    const drag = this.drag
    if (!drag) return
    // A second pointer — a stylus, a touch — would otherwise steer the camera by the distance
    // between two different hands.
    if (event.pointerId !== drag.pointerId) return
    // The reading that cannot lie, and what repairs a release swallowed by a native menu or lost
    // off the window — the same one `SceneRenderer` makes of its flight.
    if (event.buttons === 0) return this.endDrag()
    // Re-read, never captured at the press: a gizmo grabs a handle on the very event that starts
    // this, freezes the panes from its `dragging-changed`, and the drag must die there. That gate
    // used to be `OrbitControls`, which refused every move while disabled.
    if (this.armedPane !== drag.pane) return this.endDrag()

    const camera = this.cameraOfPane(drag.pane)
    const orbit = this.orbitOfPane(drag.pane)
    // A pane whose camera was swapped mid-drag has nothing left to turn — see `setPaneCamera`.
    if (!(camera instanceof PerspectiveCamera) || !orbit) return this.endDrag()

    const deltaX = event.clientX - drag.clientX
    const deltaY = event.clientY - drag.clientY
    drag.clientX = event.clientX
    drag.clientY = event.clientY
    if (deltaX === 0 && deltaY === 0) return

    // A dock still laying out measures nothing, and nothing is what both gestures would move —
    // published all the same, it repaints every store reading the framing for a view that stood.
    const height = this.rects[drag.pane]?.height ?? 0
    if (height === 0) return
    drag.moved = true

    // Now that the gizmo has NOT taken the press — it would have frozen the panes above.
    if (drag.pressedAt) {
      if (drag.kind === 'orbit')
        orbit.target.copy(this.navigationTarget.pivotAt(drag.pressedAt, camera, orbit))
      drag.pressedAt = null
    }
    this.applyGesture(drag.kind, camera, orbit, deltaX, deltaY, height)
  }

  /** What a gesture DOES to a view, whatever named it — a chord of buttons or a pair of fingers. */
  private applyGesture(
    kind: Gesture,
    camera: PerspectiveCamera,
    orbit: OrbitControls,
    deltaX: number,
    deltaY: number,
    height: number,
  ): void {
    if (kind === 'dolly') this.dollyDrag(camera, orbit, deltaX, deltaY)
    else {
      const common = {
        position: camera.position,
        quaternion: camera.quaternion,
        pivot: orbit.target,
        deltaX,
        deltaY,
        height,
      }

      if (kind === 'orbit') {
        const move = orbitAround(common)
        camera.position.copy(move.position)
        camera.quaternion.copy(move.quaternion)
      } else {
        const move = panBy({ ...common, fieldOfView: camera.fov })
        camera.position.copy(move.position)
        orbit.target.copy(move.pivot)
      }
    }

    this.requestCameraRender()
  }

  /** The chord dolly: along the line of sight, towards the pivot rather than towards a pointer
   * that is itself travelling — see `dolly.ts`. */
  private dollyDrag(
    camera: PerspectiveCamera,
    orbit: OrbitControls,
    deltaX: number,
    deltaY: number,
  ): void {
    // A camera orbited earlier in this very frame still carries the last frame's world matrix,
    // and the direction below is read out of it — the same reading `pivotAt` makes.
    camera.updateMatrixWorld()
    const move = dollyTo({
      position: camera.position,
      aim: camera.getWorldDirection(borrowedAim),
      aimed: orbit.target,
      notches: dragNotchesOf(deltaX, deltaY),
    })

    camera.position.copy(move.position)
    // Exactly what the wheel does when it crosses what it aimed at — see `onWheelCapture`.
    if (move.pivot) orbit.target.copy(move.pivot)
    else aimPivotAhead(camera, orbit.target)
  }

  /** `buttons === 0` is the reading that cannot lie: two buttons released out of order. */
  private readonly onNavigateRelease = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return this.releaseTouch(event)
    // The same reading `dragBy` makes: a second pointer going up must not end a mouse's orbit.
    const drag = this.drag
    if (event.pointerId !== drag?.pointerId) return
    // The button that NAMED the gesture ends it, even with another still down: Unreal pans on the
    // right added to the left, and reading `buttons` alone kept panning under the left alone.
    if (event.type === 'pointerup' && event.buttons !== 0 && event.button !== drag.button) return
    this.endDrag()
  }

  private endDrag(): void {
    const drag = this.drag
    this.drag = null
    // A press that never travelled a pixel is not a framing anybody decided — see the note on
    // `onCameraSettled`, which a store reads and repaints everything from.
    if (drag?.moved === true) this.options.onCameraSettled?.(drag.pane)
  }

  /**
   * Starts the frame clock now. A caller about to animate calls this first, or the first delta
   * it receives spans everything since the last frame — which was the last time anything moved,
   * possibly minutes ago — and the motion opens with a jump.
   */
  resetClock(): void {
    this.lastTime = performance.now()
  }

  /** Whether anything but the camera has moved since the last frame drew its shadow maps. */
  private shadowsStale = true
  private allShadowsStale = true

  readonly requestRender = (): void => {
    // Stale by DEFAULT, and only ever cleared by a frame that drew: whoever forgets to say what
    // moved pays a shadow pass, and whoever forgets the other way shows a shadow of what was.
    this.shadowsStale = true
    this.allShadowsStale = true
    this.schedule()
  }

  /** Schedules a depth pass that `onShadowFrame` may limit to changed lights. */
  readonly requestShadowRender = (): void => {
    this.shadowsStale = true
    this.schedule()
  }

  /**
   * A frame the CAMERA alone asked for — an orbit, a fly, a damping settling.
   *
   * A shadow map is drawn from a light, never from the camera, so the one drawn last still
   * holds. Measured while orbiting on this Mac at 1600×900: 2.6 ms against 1.9 for one sun over
   * 400 shadowed spheres, and 4.9 against 2.2 for four point lights, which cast six faces each.
   */
  readonly requestCameraRender = (): void => {
    this.schedule()
  }

  private schedule(): void {
    if (this.frame !== null || this.renderer === null) return
    this.frame = requestAnimationFrame(this.renderFrame)
  }

  /** Whether the surface was actually taken: a panel folded to nothing is turned back. */
  private readonly onResize = (): boolean => {
    const canvas = this.renderer?.domElement
    if (!canvas || !this.renderer) return false

    const { clientWidth, clientHeight } = canvas
    if (clientWidth === 0 || clientHeight === 0) return false

    this.renderer.setSize(clientWidth, clientHeight, false)
    // The main camera follows its own pane, not the canvas: in a quad layout that is a quarter
    // of it, and an aspect taken from the whole surface stretches every one of the four. Both
    // sides of the ratio are non-zero — the guard above turned back a surface with no height.
    const main = this.layOutPanes()
    this.perspective.aspect = main.width / main.height
    this.perspective.updateProjectionMatrix()
    this.fitProjection()
    this.requestRender()
    return true
  }

  /**
   * Runs the frame already asked for, now, and whatever was still moving keeps its loop.
   *
   * A motion of its own drew earlier in this same turn, into the buffer `setSize` then blanked:
   * a drag of a splitter over a moving scene costs two renders per paint, and nothing can spare
   * the first — the resize is only known about after it.
   */
  private drawPendingFrame(): void {
    if (this.frame === null) return
    cancelAnimationFrame(this.frame)
    this.renderFrame()
  }

  /**
   * The ONE call every surface of the studio draws a 3D scene through — the panes, the camera
   * preview, and whatever renders off screen.
   *
   * `onDraw` is offered the request first and answers whether it drew. That answer is not
   * decoration: what it composed is tone-mapped and encoded on the way OUT, where a plain render
   * leaves the working space behind, and both the preview's quad and a film's pixels have to know
   * which of the two they are looking at.
   */
  drawScene(request: DrawRequest): boolean {
    const renderer = this.renderer
    if (!renderer) return false

    // BEFORE `onDraw`, and it is the whole contract: a film and a still hand over a target and
    // then read its pixels back, so whoever draws must be pointed at it. Bound here rather than
    // by each caller — a composition that plans no pass answers `false` without `PostComposer`
    // ever running, and the plain render below would have gone to the canvas.
    renderer.setRenderTarget(request.target)
    if (this.options.onDraw?.(request) === true) return true

    renderer.render(request.scene, request.camera)
    return false
  }

  /**
   * One render in a single layout, four scissored ones in a quad — never four contexts.
   *
   * A second WebGL context per view would quadruple what the machine holds for a view that shows
   * the same scene, and a consumer GPU drops the oldest context when it runs out. The scissor is
   * what keeps a pane from clearing the three beside it.
   */
  private renderPanes(renderer: WebGLRenderer, refreshAllShadows: () => void): void {
    const ratio = renderer.getPixelRatio()

    if (this.extras.length === 0) {
      if (this.options.onPane?.(0, this.camera) === true) {
        refreshAllShadows()
        renderer.shadowMap.needsUpdate = true
      }
      this.drawScene({
        scene: this.scene,
        camera: this.camera,
        surface: 'pane',
        paneIndex: 0,
        cameraNodeId: null,
        target: null,
        // No rectangle at all rather than one covering the canvas: a composition then draws
        // without a scissor, which is one piece of state fewer on the frame path.
        rect: null,
        width: Math.round(renderer.domElement.clientWidth * ratio),
        height: Math.round(renderer.domElement.clientHeight * ratio),
      })
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
        // A pane that put the scene's lights out draws different shadows from the one beside
        // it: what THIS pane wears is what its maps have to be drawn from.
        if (this.options.onPane?.(index, camera) === true) {
          refreshAllShadows()
          renderer.shadowMap.needsUpdate = true
        }
        this.drawScene({
          scene: this.scene,
          camera,
          surface: 'pane',
          paneIndex: index,
          cameraNodeId: null,
          target: null,
          rect: { x, y, width, height: paneHeight },
          width: Math.round(width * ratio),
          height: Math.round(paneHeight * ratio),
        })
      }
    } finally {
      // In a `finally`, and both of them: a throw mid-pane would otherwise leave every later
      // frame — overlay included — clipped to whichever quarter failed.
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, renderer.domElement.clientWidth, height)
    }
  }

  /** Whether the preview leaves nothing of the panes to see — its grown state, in practice. */
  private insetCoversAll(): boolean {
    return this.inset?.full === true
  }

  /**
   * The camera preview, drawn over the panes in its own scissored rectangle.
   *
   * A pass rather than a fifth pane, and rather than a second context: it covers what is already
   * drawn instead of dividing the surface, and a context per preview is what `scene-stage` pays
   * elsewhere and says why.
   */
  private renderInset(renderer: WebGLRenderer, panesDrawn: boolean): void {
    const inset = this.inset
    if (!inset) return

    const ratio = renderer.getPixelRatio()
    const width = Math.max(1, Math.round(inset.rect.width * ratio))
    const height = Math.max(1, Math.round(inset.rect.height * ratio))
    const target = this.insetTargetOf(renderer, width, height)

    const now = performance.now()
    if (this.insetStale && now - this.insetDrawnAt >= INSET_CADENCE_MS) {
      this.drawInset(renderer, inset, target, panesDrawn)
      this.insetStale = false
      this.insetDrawnAt = now
    } else if (this.insetStale) {
      this.catchUpInset(now)
    }

    this.compositeInset(renderer, inset)
  }

  /**
   * The target the preview is drawn into, at the size it is shown — one device pixel per pixel,
   * so the picture is the one the direct pass used to put on the canvas.
   *
   * Multisampled to the same count as the canvas: the drawing buffer is antialiased, and a
   * preview that stopped being would read as a downgrade rather than as a saving.
   *
   * **What it costs, said out loud**: a GROWN preview holds a target the size of the canvas —
   * at 2736×1848 with 4 samples, some 160 MB of colour and depth for as long as it stays grown,
   * freed when it is folded back or closed. Bought deliberately: at that size the panes are
   * skipped and the frame went from 7,4 ms of CPU to nothing, on a machine where the CPU is what
   * runs out first.
   */
  private insetTargetOf(renderer: WebGLRenderer, width: number, height: number): WebGLRenderTarget {
    const held = this.insetHeld
    if (held && held.width === width && held.height === height) return held

    held?.dispose()
    // What the DRAWING BUFFER is antialiased to, held to what the context can offer. The ceiling
    // comes from three rather than from `gl.MAX_SAMPLES`, which the WebGL1 typing has no name for.
    const gl = renderer.getContext()
    const samples = Math.max(
      0,
      Math.min(Number(gl.getParameter(gl.SAMPLES) ?? 0), renderer.capabilities.maxSamples),
    )
    const target = new WebGLRenderTarget(width, height, { samples })
    // Linear, which is what a render into a target writes whatever the texture says — three picks
    // the WORKING space for anything but the canvas (`WebGLRenderer`, the `colorSpace` it hands
    // its output pass). Declared rather than left at the default so the quad below does not
    // decode a second time.
    target.texture.colorSpace = LinearSRGBColorSpace
    this.insetBlitOf(renderer).material.map = target.texture

    this.insetHeld = target
    // A target that has just been made holds NOTHING, so the cadence must not hold its first
    // draw back: compositing it before then samples an empty texture, and a panel being dragged
    // wider would flash the preview black for as long as the cap lasts.
    this.insetStale = true
    this.insetDrawnAt = Number.NEGATIVE_INFINITY
    return target
  }

  /** Draws the preview into its target. The costly half, and the one the cache exists to skip. */
  private drawInset(
    renderer: WebGLRenderer,
    inset: InsetPane,
    target: WebGLRenderTarget,
    panesDrawn: boolean,
  ): void {
    const restore = this.options.onInset?.(inset.camera)
    renderer.getClearColor(this.insetClear)
    const heldAlpha = renderer.getClearAlpha()
    const heldAutoClear = renderer.autoClear
    const heldMatrix = this.scene.matrixWorldAutoUpdate
    const loan = aspectLoan(target.width, target.height)

    // Redone from scratch by every `render`, and the pane pass of THIS frame has just done it
    // over a scene nothing has moved since — measured at 1,2 ms of the 5,1 the second pass cost.
    // Only when the panes actually ran: the preview camera is a node of the scene, so `render`
    // leaves its world matrix to the scene traversal (`camera.parent !== null` skips the
    // camera's own update), and a grown preview skips the panes entirely. The shadow maps need
    // no such care since `renderFrame` owns `needsUpdate`: the pane pass consumed it.
    if (panesDrawn) this.scene.matrixWorldAutoUpdate = false

    try {
      renderer.setRenderTarget(target)
      renderer.autoClear = true
      renderer.setClearColor(inset.backdrop, 1)
      loan.frame(inset.camera)
      this.dressInsetBlit(
        renderer,
        target,
        this.drawScene({
          scene: this.scene,
          camera: inset.camera,
          surface: 'inset',
          paneIndex: 0,
          cameraNodeId: inset.cameraNodeId,
          target,
          rect: null,
          width: target.width,
          height: target.height,
        }),
      )
    } finally {
      loan.restore()
      this.scene.matrixWorldAutoUpdate = heldMatrix
      renderer.autoClear = heldAutoClear
      renderer.setClearColor(this.insetClear, heldAlpha)
      renderer.setRenderTarget(null)
      // In a `finally`, as `renderPanes` does: a throw here would otherwise leave the workshop
      // hidden for every later frame.
      restore?.()
    }
  }

  /**
   * How the preview's quad reads what was just drawn into its target, and it is not a detail: get
   * it wrong and the preview comes back doubly tone-mapped, or washed out, with every gate green.
   *
   * A PLAIN render leaves the working space in the target — three skips tone mapping for anything
   * but the canvas — so the quad wears the curve on the way out and the texture stays linear. A
   * COMPOSED one has already been through the output transform, so the texture holds sRGB and the
   * quad must apply nothing: it is declared sRGB so three decodes it once and the canvas encodes
   * it once, which is the identity.
   */
  private dressInsetBlit(
    renderer: WebGLRenderer,
    target: WebGLRenderTarget,
    composed: boolean,
  ): void {
    const blit = this.insetBlitOf(renderer)
    const space = composed ? SRGBColorSpace : LinearSRGBColorSpace
    const toneMapped = !composed && renderer.toneMapping !== NoToneMapping

    if (target.texture.colorSpace !== space) {
      target.texture.colorSpace = space
      // The colour space is a shader DEFINE on the material sampling it, not a uniform.
      blit.material.needsUpdate = true
    }
    if (blit.material.toneMapped !== toneMapped) {
      blit.material.toneMapped = toneMapped
      blit.material.needsUpdate = true
    }
  }

  /**
   * Puts the drawn preview on the canvas: one textured quad inside the scissor, and nothing else.
   *
   * This is what a frame costs when only the view moved — one draw call against the second full
   * traversal of the scene the direct pass paid for.
   */
  private compositeInset(renderer: WebGLRenderer, inset: InsetPane): void {
    const surface = renderer.domElement.clientHeight
    const gl = glRect(inset.rect, surface)
    const blit = this.insetBlitOf(renderer)
    const heldAutoClear = renderer.autoClear

    renderer.setScissorTest(true)
    try {
      // A grown preview leaves the panes undrawn, and the DOM frame keeps two pixels of canvas
      // outside the picture: cleared here, or those pixels would hold whatever the last frame
      // that did draw them left behind.
      if (this.insetCoversAll()) {
        renderer.setScissor(0, 0, renderer.domElement.clientWidth, surface)
        renderer.setClearColor(inset.backdrop, 1)
        renderer.clear(true, true, false)
      }
      renderer.setViewport(gl.x, gl.y, gl.width, gl.height)
      renderer.setScissor(gl.x, gl.y, gl.width, gl.height)
      renderer.autoClear = false
      blit.quad.renderToScreen(blit.material)
    } finally {
      renderer.autoClear = heldAutoClear
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, renderer.domElement.clientWidth, surface)
    }
  }

  /** The target and the quad, both held by the GPU until something says otherwise. */
  private disposeInset(): void {
    this.insetHeld?.dispose()
    this.insetHeld = null

    this.insetBlit?.quad.dispose()
    this.insetBlit?.material.dispose()
    this.insetBlit = null
  }

  /**
   * The quad that composites the preview, and the material it wears.
   *
   * `GpuPipeline` is the studio's own full-frame quad — the same one every image filter draws
   * through — rather than a second scene and camera written here.
   */
  private insetBlitOf(renderer: WebGLRenderer): InsetBlit {
    if (this.insetBlit) return this.insetBlit

    this.insetBlit = {
      quad: createGpuPipeline(renderer),
      // Applied on the way OUT and never inside the target: three skips tone mapping for anything
      // but the canvas (`WebGLPrograms`, `currentRenderTarget === null`), so the quad is where the
      // preview meets the same curve the panes do.
      material: new MeshBasicMaterial({
        depthTest: false,
        depthWrite: false,
        toneMapped: renderer.toneMapping !== NoToneMapping,
      }),
    }
    return this.insetBlit
  }

  /**
   * Wakes the loop once the cap has run out, so a change held back is never the last word.
   *
   * Without it a preview whose content moved on the very frame the loop went to sleep would keep
   * showing the instant before, until something else asked for a frame.
   */
  private catchUpInset(now: number): void {
    if (this.insetCatchUp !== null) return
    this.insetCatchUp = setTimeout(
      () => {
        this.insetCatchUp = null
        this.requestRender()
      },
      Math.max(0, INSET_CADENCE_MS - (now - this.insetDrawnAt)),
    )
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
    // Only where `OrbitControls` still owns the gestures — `armOrbits` says why `enabled` is
    // that reading, and why `update()` must never run on a pane the pointer turns itself.
    let settling = this.controls?.enabled === true && this.controls.update()
    for (const pane of this.extras) {
      if (pane.controls?.enabled === true && pane.controls.update()) settling = true
    }

    // The panes are skipped when the preview covers them whole: drawing a scene twice over to
    // throw the first one away is the most expensive thing a frame can do.
    // Read by the first pass of the frame alone: three.js turns it back off once it has drawn
    // the maps, and the preview pass behind it reuses what this one left.
    const shadowsStale = this.shadowsStale
    renderer.shadowMap.needsUpdate = shadowsStale
    this.shadowsStale = false

    let restoreShadows = shadowsStale
      ? this.options.onShadowFrame?.(this.allShadowsStale)
      : undefined
    this.allShadowsStale = false
    const refreshAllShadows = (): void => {
      restoreShadows?.()
      restoreShadows = undefined
    }
    const panesDrawn = !this.insetCoversAll()
    const renderStarted = performance.now()
    const timesGpu = this.gpuFramesWanted > 0
    if (timesGpu) {
      this.gpuFramesWanted -= 1
      this.gpuTimer?.begin()
    }
    try {
      if (panesDrawn) this.renderPanes(renderer, refreshAllShadows)
      // After the panes and before the overlay: the preview covers the view it sits on, and the
      // trihedron stays on top of both.
      this.renderInset(renderer, panesDrawn)
    } finally {
      refreshAllShadows()
    }
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
    if (timesGpu) this.gpuTimer?.end()

    // Read per frame, never cached: a context restore replaces `info` and its two counter objects.
    recordFrame(renderer.info, this.stats, performance.now() - renderStarted)
    this.stats.gpuFrameMs = timesGpu ? (this.gpuTimer?.read() ?? null) : null

    // Armed again for whatever renders BETWEEN two frames — a film being written out, a capture,
    // a scene clip — none of which comes through here and none of which would know to ask. The
    // reuse is a property of the next viewport frame, so it is granted there and nowhere else:
    // an exported video was reusing the maps of the pose the Render button was pressed on.
    renderer.shadowMap.needsUpdate = true

    if (moving || settling) {
      // A fly and a damping settling move the camera and nothing else: the shadow maps this
      // frame drew are the ones the next one wants.
      this.requestCameraRender()
      return
    }

    // The loop stops here, so the clock goes back to rest: without this every caller that starts
    // an animation would have to call `resetClock` itself, and the one that forgot would open its
    // motion on a `MAX_DELTA` jump.
    this.lastTime = null
  }
}
