import { selectionOutline, type CanvasSelection } from './canvas-selection'
import type { Guide, Rect } from './canvas-state'
import { cropChrome } from './crop'
import { gripRects, HANDLE_IDS, outlinePoints, type Corners, type HandleId } from './handles'
import { rulerStep, tickLabel, ticks } from './rulers'
import { shapeOutline, type ShapeGeometry } from './shape-geometry'
import { crisp, toScreen, visibleRect, type Viewport } from './viewport'
import type { Point, Size } from '../core/geometry'

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
  | 'arc'
  | 'stroke'
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'setLineDash'
  | 'lineDashOffset'
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
  /** The two strokes of the marching ants — see the tokens for why they are white and black. */
  marqueeLight: string
  marqueeDark: string
  /** Translucent: it dims what a crop is about to cut away without hiding it. */
  scrim: string
}

/** The dash pattern of the marching ants, in screen pixels, and how long one period lasts. */
const ANT_DASH = 5
const ANT_GAP = 4
const ANT_PERIOD_MS = 500

/**
 * How far along its pattern the dash has marched, from a clock rather than from a frame counter:
 * the ants have to crawl at the same speed on a screen that drops frames as on one that does not.
 */
export function antPhase(time: number): number {
  return ((time % ANT_PERIOD_MS) / ANT_PERIOD_MS) * (ANT_DASH + ANT_GAP)
}

/**
 * The marching ants, in the one place every dashed outline goes through.
 *
 * Two strokes over the same path: a plain light one, then a dark dashed one that marches over it.
 * The alternation is what keeps the outline readable over anything the document holds — a single
 * dashed stroke disappears against a background of its own colour, whichever colour that is.
 *
 * One helper for all three surfaces that dash — the selection, the crop frame, the shape being
 * drawn — so drift between them is not merely unlikely but impossible.
 */
export function ants(
  context: OverlayContext,
  trace: () => void,
  phase: number,
  colors: OverlayColors,
): void {
  twoTone(context, trace, colors, 1.5, () => {
    context.setLineDash([ANT_DASH, ANT_GAP])
    // Negative, so the dashes travel the way the path was traced rather than against it.
    context.lineDashOffset = -phase
  })

  context.setLineDash([])
  context.lineDashOffset = 0
}

/**
 * A path stroked twice — a plain light pass, then a dark one over it — which is what keeps an
 * outline readable over anything the document holds. A single stroke disappears against a
 * background of its own colour, whichever colour that is.
 *
 * `beforeDark` is where the second pass differs: the ants dash and march there, the brush ring
 * only narrows. Shared so the two cannot drift into two ideas of what "readable" means.
 */
function twoTone(
  context: OverlayContext,
  trace: () => void,
  colors: OverlayColors,
  width: number,
  beforeDark: () => void,
): void {
  context.lineWidth = width
  context.setLineDash([])
  context.strokeStyle = colors.marqueeLight
  trace()
  context.stroke()

  beforeDark()
  context.strokeStyle = colors.marqueeDark
  trace()
  context.stroke()

  context.lineWidth = 1
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
  /**
   * The armed layer's box, as its four corners — `null` unless the move tool holds a layer free
   * to move. Corners rather than a rectangle: under a rotation the box is not one, and grips
   * derived from an axis-aligned rectangle floated beside the picture they claimed to hold.
   */
  handles: Corners | null
  /** The grip under the pointer, drawn a pixel wider. `null` when the hand is elsewhere. */
  lit: HandleId | null
  /** The shape under the hand, outlined until it is committed to the layer. */
  pending: ShapeGeometry | null
  selection: CanvasSelection
  /**
   * Half the brush, in DOCUMENT units, while a painting tool is armed — `null` for every other
   * tool. Drawn rather than set as a CSS cursor because a cursor cannot scale: the ring has to
   * cover exactly what the next dab will, at 5% as at 1600%.
   */
  brushRadius: number | null
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
  /**
   * The graduations' font, shorthand and ready to assign. Beside the colours rather than among
   * them: it is read the same way, off the same element, but it is not one.
   */
  rulerFont: string
  /** What the graduations are written in. `undefined` before React has pushed one. */
  language: string | undefined
  /**
   * Whether anything on screen is dashed. The frame loop keeps booking frames while it is true
   * and stops the moment it is not: ants that marched on an empty canvas would be a rAF running
   * for the life of the document, which the UI thread has better uses for.
   */
  marching: boolean
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
export function drawOverlay(context: OverlayContext, scene: OverlayScene, phase = 0): void {
  context.clearRect(0, 0, scene.host.width, scene.host.height)
  context.save()
  // Every stroke here is chrome, so nothing scales with the zoom.
  context.lineWidth = 1
  context.setLineDash([])

  drawFrame(context, scene)
  if (scene.showGuides) drawGuides(context, scene)
  drawTools(context, scene, phase)
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

function drawTools(context: OverlayContext, scene: OverlayScene, phase: number): void {
  drawSelection(context, scene, phase)
  drawPending(context, scene, phase)
  drawCrop(context, scene, phase)
  drawGrips(context, scene)
  // Last: the ring stands in for the cursor, and a cursor is never under what it points at.
  drawBrush(context, scene)
}

/**
 * The brush's footprint under the hand, at the diameter the next dab will actually cover.
 *
 * Undashed, unlike the ants: a dash would have to march, and marching is what keeps a frame
 * loop alive for as long as the tool is armed.
 */
function drawBrush(context: OverlayContext, scene: OverlayScene): void {
  const radius = scene.tools.brushRadius
  const at = scene.pointer
  if (radius === null || !at) return

  twoTone(
    context,
    () => {
      context.beginPath()
      context.arc(at.x, at.y, radius * scene.viewport.scale, 0, Math.PI * 2)
    },
    scene.colors,
    3,
    () => {
      context.lineWidth = 1
    },
  )
}

function drawSelection(context: OverlayContext, scene: OverlayScene, phase: number): void {
  const outline = selectionOutline(scene.tools.selection)
  if (outline.length === 0) return

  ants(context, () => tracePath(context, scene.viewport, outline), phase, scene.colors)
}

function drawPending(context: OverlayContext, scene: OverlayScene, phase: number): void {
  const shape = scene.tools.pending
  if (!shape) return

  const outline = shapeOutline(shape)
  ants(context, () => tracePath(context, scene.viewport, outline), phase, scene.colors)
}

function drawCrop(context: OverlayContext, scene: OverlayScene, phase: number): void {
  const rect = scene.tools.crop
  if (!rect) return

  const { scrim, frame, grips } = cropChrome(rect, scene.viewport, scene.document)

  context.fillStyle = scene.colors.scrim
  for (const band of scrim) context.fillRect(band.x, band.y, band.width, band.height)

  // The same ants as a selection: what a frame promises to keep and what a marquee encloses are
  // the same kind of statement, and the eye should not have to learn two ways of reading it.
  ants(context, () => traceRect(context, frame), phase, scene.colors)

  context.fillStyle = scene.colors.accent
  for (const grip of grips) context.fillRect(grip.x, grip.y, grip.width, grip.height)
}

/**
 * The armed layer's outline and its eight grips, drawn only while the move tool holds them —
 * Pixi ships no transformer, so these are ours.
 *
 * The outline matters as much as the grips: eight squares with nothing between them said where
 * the corners were without ever saying what was selected.
 */
function drawGrips(context: OverlayContext, scene: OverlayScene): void {
  const corners = scene.tools.handles
  if (!corners) return

  context.strokeStyle = scene.colors.accent
  context.fillStyle = scene.colors.accent
  tracePath(context, scene.viewport, outlinePoints(corners))
  context.stroke()

  const grips = gripRects(corners, scene.viewport)

  for (const id of HANDLE_IDS) {
    const grip = grips[id]
    // The one under the pointer grows by a pixel on each side: it is the only feedback saying
    // the grip is within reach before the button goes down.
    const grow = id === scene.tools.lit ? 1 : 0
    context.fillRect(grip.x - grow, grip.y - grow, grip.width + grow * 2, grip.height + grow * 2)
  }
}

/** The four sides of a rectangle, laid down for `ants` to stroke twice. */
function traceRect(context: OverlayContext, rect: Rect): void {
  context.beginPath()
  context.moveTo(rect.x, rect.y)
  context.lineTo(rect.x + rect.width, rect.y)
  context.lineTo(rect.x + rect.width, rect.y + rect.height)
  context.lineTo(rect.x, rect.y + rect.height)
  context.lineTo(rect.x, rect.y)
}

/**
 * A closed polyline, in screen space: a selection is chrome, and chrome never scales.
 *
 * Laid down without being stroked, because the marching ants stroke the same path twice — the
 * light pass and the dark dashed one over it.
 */
function tracePath(context: OverlayContext, viewport: Viewport, outline: readonly Point[]): void {
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
}

/**
 * Two bands, top and left, graduated in document units. They are drawn last so the guides slide
 * under them rather than over — a guide crossing its own ruler reads as a broken line.
 */
function drawRulers(context: OverlayContext, scene: OverlayScene): void {
  const { host, viewport, colors, rulerFont, language } = scene
  const step = rulerStep(viewport.scale)
  const visible = visibleRect(viewport, host)

  context.fillStyle = colors.rulerBackground
  context.fillRect(0, 0, host.width, RULER_SIZE)
  context.fillRect(0, 0, RULER_SIZE, host.height)

  context.strokeStyle = colors.rulerTick
  line(context, 0, crisp(RULER_SIZE), host.width, crisp(RULER_SIZE))
  line(context, crisp(RULER_SIZE), 0, crisp(RULER_SIZE), host.height)

  context.font = rulerFont
  context.textBaseline = 'top'
  context.textAlign = 'left'
  context.fillStyle = colors.rulerText

  for (const value of ticks(visible.x, visible.x + visible.width, step.minor)) {
    const x = crisp(toScreen(viewport, { x: value, y: 0 }).x)
    if (x < RULER_SIZE) continue

    const major = isMajor(value, step.major)
    line(context, x, major ? 0 : RULER_SIZE - MINOR_TICK, x, RULER_SIZE)
    if (major) context.fillText(tickLabel(value, step.major, language), x + 2, 2)
  }

  for (const value of ticks(visible.y, visible.y + visible.height, step.minor)) {
    const y = crisp(toScreen(viewport, { x: 0, y: value }).y)
    if (y < RULER_SIZE) continue

    const major = isMajor(value, step.major)
    line(context, major ? 0 : RULER_SIZE - MINOR_TICK, y, RULER_SIZE, y)
    if (!major) continue

    // Vertical text would need a rotation per label; every editor stacks the digits instead.
    const label = tickLabel(value, step.major, language)
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

  private readonly draw = (time: number): void => {
    this.frame = 0
    const scene = this.scene()
    if (!scene) return

    if (this.context) drawOverlay(this.context, scene, antPhase(time))
    // Ants keep marching, and nothing else keeps the loop alive: a frame is booked for the next
    // step only while something on screen is actually dashed. Decided from the scene rather than
    // from the context, so what governs the loop is what is on screen and nothing else.
    if (scene.marching) this.invalidate()
  }
}
