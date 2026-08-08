import { selectionOutline, type CanvasSelection } from './canvas-selection'
import type { Guide, Rect } from './canvas-state'
import { cropChrome } from './crop'
import { gripRects, HANDLE_IDS } from './handles'
import { rulerStep, tickLabel, ticks } from './rulers'
import { shapeOutline, type Point, type ShapeGeometry } from './shape-geometry'
import { crisp, toScreen, visibleRect, type Size, type Viewport } from './viewport'

/**
 * The 2D overlay drawn above the Pixi canvas. It holds no pixel of the document: everything here
 * is chrome — the frame, the rulers, the guides, the selection — and none of it reaches the
 * export, which renders the Pixi side alone.
 *
 * It draws in SCREEN coordinates, never in document ones. That is what keeps a hairline one real
 * pixel wide at 1600% as well as at 5%.
 */

/** Only what the overlay actually touches, so a test can hand it a recorder instead of a canvas. */
export type OverlayContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'clearRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'setLineDash'
  | 'lineWidth'
  | 'strokeStyle'
  | 'fillStyle'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
>

/** Read off the stylesheet by the caller: the studio palette lives in CSS, not in this file. */
export type OverlayColors = {
  frame: string
  guide: string
  rulerBackground: string
  rulerText: string
  rulerTick: string
  accent: string
  /** Translucent: it dims what a crop is about to cut away without hiding it. */
  scrim: string
}

export const RULER_SIZE = 20

/** How far a minor tick reaches into the ruler band. */
const MINOR_TICK = 4

/**
 * What the active tool has on screen right now, in DOCUMENT units — the engine hands over its
 * state rather than a painter closed over itself. That is what makes the chrome readable from a
 * test: jsdom hands out no 2D context, so a painter the engine kept could never be run.
 */
export type ToolChrome = {
  /** The crop frame once placed. It outlives its drag, which is what makes the grips real. */
  crop: Rect | null
  /** The armed layer's box — `null` unless the move tool holds a layer free to move. */
  handles: Rect | null
  /** The shape under the hand, outlined until it is committed to the layer. */
  pending: ShapeGeometry | null
  selection: CanvasSelection
}

export type OverlayScene = {
  viewport: Viewport
  host: Size
  document: Size
  showRulers: boolean
  showGuides: boolean
  guides: readonly Guide[]
  /** Highlighted while it is being dragged, so the hand knows which one it took. */
  activeGuideId: string | null
  /** Where the pointer is, in screen pixels — the rulers echo it. `null` once it leaves. */
  pointer: Point | null
  colors: OverlayColors
  /** The active tool's own chrome, drawn last and in screen space. */
  tools: ToolChrome
}

function line(context: OverlayContext, x1: number, y1: number, x2: number, y2: number): void {
  context.beginPath()
  context.moveTo(x1, y1)
  context.lineTo(x2, y2)
  context.stroke()
}

/**
 * One frame of the overlay. Pure in everything but the context: the scene decides, this only
 * puts it on screen — which is what lets it be tested without a GPU.
 */
export function drawOverlay(context: OverlayContext, scene: OverlayScene): void {
  context.clearRect(0, 0, scene.host.width, scene.host.height)
  context.save()
  // Every stroke here is chrome, so nothing scales with the zoom.
  context.lineWidth = 1
  context.setLineDash([])

  drawFrame(context, scene)
  if (scene.showGuides) drawGuides(context, scene)
  drawTools(context, scene)
  if (scene.showRulers) drawRulers(context, scene)

  context.restore()
}

/** The document's own edge — without it a white layer on a dark panel has no boundary. */
function drawFrame(context: OverlayContext, scene: OverlayScene): void {
  const origin = toScreen(scene.viewport, { x: 0, y: 0 })
  const corner = toScreen(scene.viewport, { x: scene.document.width, y: scene.document.height })

  context.strokeStyle = scene.colors.frame
  context.strokeRect(
    crisp(origin.x),
    crisp(origin.y),
    Math.round(corner.x - origin.x),
    Math.round(corner.y - origin.y),
  )
}

function drawGuides(context: OverlayContext, scene: OverlayScene): void {
  for (const guide of scene.guides) {
    context.strokeStyle =
      guide.id === scene.activeGuideId ? scene.colors.accent : scene.colors.guide

    if (guide.axis === 'x') {
      const x = crisp(toScreen(scene.viewport, { x: guide.position, y: 0 }).x)
      line(context, x, 0, x, scene.host.height)
    } else {
      const y = crisp(toScreen(scene.viewport, { x: 0, y: guide.position }).y)
      line(context, 0, y, scene.host.width, y)
    }
  }
}

function drawTools(context: OverlayContext, scene: OverlayScene): void {
  drawSelection(context, scene)
  drawPending(context, scene)
  drawCrop(context, scene)
  drawGrips(context, scene)
}

function drawSelection(context: OverlayContext, scene: OverlayScene): void {
  const outline = selectionOutline(scene.tools.selection)
  if (outline.length === 0) return

  context.strokeStyle = scene.colors.accent
  context.setLineDash([4, 4])
  strokePath(context, scene.viewport, outline)
  context.setLineDash([])
}

function drawPending(context: OverlayContext, scene: OverlayScene): void {
  const shape = scene.tools.pending
  if (!shape) return

  context.strokeStyle = scene.colors.accent
  strokePath(context, scene.viewport, shapeOutline(shape))
}

/**
 * Nothing here outlives the gesture: the frame applies on release, so one still on screen
 * afterwards would promise an adjustment step that does not exist.
 */
function drawCrop(context: OverlayContext, scene: OverlayScene): void {
  const rect = scene.tools.crop
  if (!rect) return

  const { scrim, frame, grips } = cropChrome(rect, scene.viewport, scene.document)

  context.fillStyle = scene.colors.scrim
  for (const band of scrim) context.fillRect(band.x, band.y, band.width, band.height)

  context.strokeStyle = scene.colors.accent
  context.strokeRect(frame.x, frame.y, frame.width, frame.height)

  context.fillStyle = scene.colors.accent
  for (const grip of grips) context.fillRect(grip.x, grip.y, grip.width, grip.height)
}

/**
 * The nine grips of the armed layer, drawn only while the move tool holds them — Pixi ships no
 * transformer, so these are ours.
 */
function drawGrips(context: OverlayContext, scene: OverlayScene): void {
  const box = scene.tools.handles
  if (!box) return

  const grips = gripRects(box, scene.viewport)
  context.strokeStyle = scene.colors.accent
  context.fillStyle = scene.colors.accent

  for (const id of HANDLE_IDS) {
    const grip = grips[id]
    context.fillRect(grip.x, grip.y, grip.width, grip.height)
  }
}

/** A closed polyline, in screen space: a selection is chrome, and chrome never scales. */
function strokePath(context: OverlayContext, viewport: Viewport, outline: readonly Point[]): void {
  const first = outline[0]
  if (!first) return

  const at = (point: Point): Point => {
    const screen = toScreen(viewport, point)
    return { x: crisp(screen.x), y: crisp(screen.y) }
  }

  context.beginPath()
  const start = at(first)
  context.moveTo(start.x, start.y)
  for (const point of outline.slice(1)) {
    const screen = at(point)
    context.lineTo(screen.x, screen.y)
  }
  // Closed by hand rather than with `closePath`: a lasso is left open by the hand that drew it,
  // and the region it stands for is the closed one.
  context.lineTo(start.x, start.y)
  context.stroke()
}

/**
 * Two bands, top and left, graduated in document units. They are drawn last so the guides slide
 * under them rather than over — a guide crossing its own ruler reads as a broken line.
 */
function drawRulers(context: OverlayContext, scene: OverlayScene): void {
  const { host, viewport, colors } = scene
  const step = rulerStep(viewport.scale)
  const visible = visibleRect(viewport, host)

  context.fillStyle = colors.rulerBackground
  context.fillRect(0, 0, host.width, RULER_SIZE)
  context.fillRect(0, 0, RULER_SIZE, host.height)

  context.strokeStyle = colors.rulerTick
  line(context, 0, crisp(RULER_SIZE), host.width, crisp(RULER_SIZE))
  line(context, crisp(RULER_SIZE), 0, crisp(RULER_SIZE), host.height)

  context.font = '9px system-ui, sans-serif'
  context.textBaseline = 'top'
  context.textAlign = 'left'
  context.fillStyle = colors.rulerText

  for (const value of ticks(visible.x, visible.x + visible.width, step.minor)) {
    const x = crisp(toScreen(viewport, { x: value, y: 0 }).x)
    if (x < RULER_SIZE) continue

    const major = isMajor(value, step.major)
    line(context, x, major ? 0 : RULER_SIZE - MINOR_TICK, x, RULER_SIZE)
    if (major) context.fillText(tickLabel(value, step.major), x + 2, 2)
  }

  for (const value of ticks(visible.y, visible.y + visible.height, step.minor)) {
    const y = crisp(toScreen(viewport, { x: 0, y: value }).y)
    if (y < RULER_SIZE) continue

    const major = isMajor(value, step.major)
    line(context, major ? 0 : RULER_SIZE - MINOR_TICK, y, RULER_SIZE, y)
    if (!major) continue

    // Vertical text would need a rotation per label; every editor stacks the digits instead.
    const label = tickLabel(value, step.major)
    label.split('').forEach((glyph, index) => context.fillText(glyph, 2, y + 2 + index * 8))
  }

  drawPointerMarks(context, scene)

  // The square where the two bands meet, or the horizontal ticks run under the vertical ruler.
  context.fillStyle = colors.rulerBackground
  context.fillRect(0, 0, RULER_SIZE, RULER_SIZE)
  context.strokeStyle = colors.rulerTick
  line(context, 0, crisp(RULER_SIZE), RULER_SIZE, crisp(RULER_SIZE))
  line(context, crisp(RULER_SIZE), 0, crisp(RULER_SIZE), RULER_SIZE)
}

/** Floating point drift: a tick at 299.99999999 is the major at 300. */
function isMajor(value: number, major: number): boolean {
  const remainder = Math.abs(value % major)
  return remainder < 1e-6 || Math.abs(remainder - major) < 1e-6
}

function drawPointerMarks(context: OverlayContext, scene: OverlayScene): void {
  if (!scene.pointer) return

  context.strokeStyle = scene.colors.accent
  line(context, crisp(scene.pointer.x), 0, crisp(scene.pointer.x), RULER_SIZE)
  line(context, 0, crisp(scene.pointer.y), RULER_SIZE, crisp(scene.pointer.y))
}

/**
 * The overlay's own canvas and its frame loop. Nothing is scheduled until something asks for a
 * frame: a canvas cleared and redrawn sixty times a second for an unchanged scene is a fan
 * spinning for nothing, and so is a `requestAnimationFrame` that wakes only to find nothing to do.
 */
export class CanvasOverlay {
  private readonly canvas = document.createElement('canvas')
  private readonly context: CanvasRenderingContext2D | null
  private frame = 0

  constructor(private readonly scene: () => OverlayScene | null) {
    this.canvas.style.position = 'absolute'
    this.canvas.style.inset = '0'
    // Every gesture belongs to the engine below: an overlay that swallowed clicks would make the
    // canvas unpaintable.
    this.canvas.style.pointerEvents = 'none'
    this.context = this.canvas.getContext('2d')
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.canvas)
    this.invalidate()
  }

  /** Books the next frame, once. Cheap enough to call from any pointer move. */
  invalidate(): void {
    if (this.frame === 0) this.frame = requestAnimationFrame(this.draw)
  }

  resize(size: Size): void {
    // Backing store in device pixels, drawing in CSS ones: a hairline stays a hairline on a
    // Retina display instead of being drawn two physical pixels wide.
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(size.width * ratio))
    const height = Math.max(1, Math.round(size.height * ratio))

    // Only when it actually changed: assigning `width` at all throws the backing store away and
    // reallocates it, even for the same value — and a ResizeObserver fires on every layout pass.
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.canvas.style.width = `${size.width}px`
      this.canvas.style.height = `${size.height}px`
    }
    // Outside the guard: the transform is lost with the backing store, and a devicePixelRatio
    // change (a window dragged to another display) keeps the same pixel size.
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.invalidate()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.canvas.remove()
  }

  private readonly draw = (): void => {
    this.frame = 0
    const scene = this.scene()
    if (scene && this.context) drawOverlay(this.context, scene)
  }
}
