import { NEUTRAL_ADJUSTMENTS, type AdjustmentStack } from '@shared/domain/adjustments'
import type { BlendMode } from '@shared/domain/canvasBlend'
import { DEFAULT_FONT, type FontRef } from '@shared/domain/font'
import type { Point, Size } from '../core/geometry'

/**
 * An image document, as plain data. It holds no Pixi object on purpose: an engine is rebuilt
 * from its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 *
 * Pixels are NOT here — they live in a GPU texture per layer, owned by `CanvasEngine` and keyed
 * by layer id. This is what a layer *is*, not what it shows.
 */

/**
 * What each padlock holds. Three of them rather than one boolean: locking a layer's position
 * while still painting on it is the ordinary case, not an advanced one.
 */
export type LayerLocks = {
  pixels: boolean
  position: boolean
  alpha: boolean
}

export const UNLOCKED: LayerLocks = { pixels: false, position: false, alpha: false }

/** The three, in the order every surface offers them — the panel's rows, and `layer.lock`. */
export const LOCK_KEYS: readonly (keyof LayerLocks)[] = ['pixels', 'position', 'alpha']

export type Rect = { x: number; y: number; width: number; height: number }

/** Origin is a fraction of the bounding box, so a resize does not move the pivot. */
export type Transform = {
  x: number
  y: number
  scaleX: number
  scaleY: number
  /** Radians. */
  rotation: number
  skewX: number
  skewY: number
  originX: number
  originY: number
}

export const IDENTITY: Transform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  originX: 0.5,
  originY: 0.5,
}

export type LayerBase = {
  id: string
  name: string
  visible: boolean
  locked: LayerLocks
  /** 0 to 1. */
  opacity: number
  /** Affects the pixels, not the effects drawn around them. 0 to 1. */
  fillOpacity: number
  blend: BlendMode
  /**
   * A blend mask: 8-bit, independent of the pixels, and owned by the engine like them. `linked`
   * is whether moving the layer moves the mask with it.
   */
  mask?: { enabled: boolean; linked: boolean }
  /** This layer is cut out by the one below it. */
  clipped: boolean
  transform: Transform
}

export type PixelLayer = LayerBase & {
  kind: 'pixel'
  /**
   * Packed RGB painted edge to edge when the layer is born, and never again — this is what
   * gives a new document its white page. Absent leaves the layer transparent.
   */
  fill?: number
  /**
   * The asset whose picture the layer was born holding, drawn into its texture as soon as the
   * surface exists. In the state rather than pushed at the engine: pixels do not survive a
   * closed tab, an undo or a detached panel, and this is what brings them back.
   */
  source?: string
}

/** `pass-through` lets an adjustment inside the group reach what is under the group. */
export type GroupIsolation = 'pass-through' | 'isolate'

export type GroupLayer = LayerBase & {
  kind: 'group'
  children: Layer[]
  collapsed: boolean
  isolation: GroupIsolation
}

/**
 * Which dial an adjustment layer exposes. Four, and only four, because these are the ones the
 * grading pass actually applies — a `curves` or a `LUT` entry would be a row in the panel that
 * changes nothing on screen, which is the one thing a layer must never be.
 */
export type AdjustmentKind = 'exposure' | 'contrast' | 'saturation' | 'temperature'

export const ADJUSTMENT_KINDS: readonly AdjustmentKind[] = [
  'exposure',
  'contrast',
  'saturation',
  'temperature',
]

/**
 * How far each dial swings. Beside the kinds rather than in the panel that draws them: the slider
 * and the schema of `layer.setAdjustmentAmount` publish the same range, and a second copy would drift.
 */
export const DIAL_RANGE: Readonly<Record<AdjustmentKind, { min: number; max: number }>> = {
  // Stops, so ±3 is the range a photograph is recoverable within.
  exposure: { min: -3, max: 3 },
  contrast: { min: 0, max: 2 },
  saturation: { min: 0, max: 2 },
  temperature: { min: -1, max: 1 },
}

export type AdjustmentLayer = LayerBase & {
  kind: 'adjustment'
  adjustment: AdjustmentKind
  /**
   * The whole stack, not just the dial this layer names: the pass is one shader, and carrying
   * the others at their neutral costs nothing while keeping two layers from needing two passes.
   */
  values: AdjustmentStack
}

export function adjustmentLayer(
  id: string,
  name: string,
  adjustment: AdjustmentKind,
): AdjustmentLayer {
  // Copied, never the shared constant itself: one mutation of it anywhere would neutralise every
  // adjustment layer in the application at once.
  return {
    ...layerBase(id, name),
    kind: 'adjustment',
    adjustment,
    values: { ...NEUTRAL_ADJUSTMENTS },
  }
}

/**
 * Words rather than pixels. Kept as text so it stays editable and stays sharp at any zoom — a
 * caption rasterized at the moment it was typed is a caption nobody can fix a typo in.
 */
export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export const TEXT_ALIGNS: readonly TextAlign[] = ['left', 'center', 'right', 'justify']

export type TextLayer = LayerBase & {
  kind: 'text'
  text: string
  /**
   * What it is set in. The same reference a 3D text stores, from the same list — see
   * `domain/font`: a studio where the two workspaces name their typefaces differently is a
   * studio where the same caption cannot be moved from one to the other.
   */
  font: FontRef
  /** Points at 1:1, before the layer's own scale. */
  size: number
  /** Packed RGB, the form Pixi takes. */
  color: number
  /**
   * What the words wrap inside, in document units — a PARAGRAPH caption. What outgrows it in
   * height is hidden rather than spilled, and the box says so; nothing is lost, and widening it
   * brings the rest back.
   *
   * `null` is the other kind, which a plain click opens: a POINT caption has no box at all. Its
   * line simply grows, only a typed return breaks it, and there is nothing for it to outgrow.
   */
  box: Size | null
  align: TextAlign
  /** A multiple of the size, so a caption keeps its leading when it is set bigger. */
  lineHeight: number
  /** Thousandths of an em, the unit a type panel shows — Photoshop's own. */
  tracking: number
}

export const DEFAULT_TEXT_SIZE = 48

export const DEFAULT_LINE_HEIGHT = 1.2

/** A frame with no surface is not a frame. */
export function sided(value: number): number {
  return Math.max(1, Math.round(value))
}

/** No document has a longer side, so past this a cell is a mistake rather than a coarse grid. */
const MAX_PIXEL_CELL = 8192

/**
 * A legal grid, or none. `sided` is not enough here: it answers `NaN` for `NaN`, which
 * `JSON.stringify` writes as `null` — a document broken for the session and clean on reopening.
 */
export function pixelCellOf(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return null
  return Math.min(Math.floor(raw), MAX_PIXEL_CELL)
}

/** Whether the picture is drawn on a grid at all — the question every renderer asks first. */
export function onPixelGrid(state: CanvasState | null): boolean {
  return state !== null && state.pixelCell !== null
}

/**
 * A text box as a layer stores one. The engine reads drags in floats, so one taken at 74% zoom
 * comes back as 471.5789473684211 — and the panel's fields keep every digit they are handed.
 */
export function wholeBox(box: Size): Size {
  return { width: sided(box.width), height: sided(box.height) }
}

/** `box` absent is a POINT caption, which is what a plain click opens — see `TextLayer.box`. */
export function textLayer(id: string, text: string, at: Point, box: Size | null = null): TextLayer {
  return {
    // Named after its words, and after the KIND while it has none: a nameless row in the stack
    // is a row nobody can find the caption back by.
    ...layerBase(id, text),
    kind: 'text',
    text,
    font: DEFAULT_FONT,
    size: DEFAULT_TEXT_SIZE,
    color: 0x000000,
    box: box && wholeBox(box),
    align: 'left',
    lineHeight: DEFAULT_LINE_HEIGHT,
    tracking: 0,
    transform: { ...IDENTITY, x: at.x, y: at.y },
  }
}

/**
 * Which shape a shape layer holds. Declared here rather than beside the arithmetic that derives
 * it: `shapeGeometry` reads this file, and a stored layer must not depend on a Pixi-facing module.
 */
export type ShapeKind = 'rectangle' | 'line' | 'arrow' | 'ellipse' | 'polygon' | 'star'

/** Figma's order, which is the order of the menu the user reads. */
export const SHAPE_KINDS: readonly ShapeKind[] = [
  'rectangle',
  'line',
  'arrow',
  'ellipse',
  'polygon',
  'star',
]

export type ShapeStroke = { color: number; width: number }

/**
 * A shape kept as its two points rather than as pixels, so it stays editable: changing the fill
 * of a rectangle drawn an hour ago redraws it, where a rasterized one would have to be undone.
 */
export type ShapeLayer = LayerBase & {
  kind: 'shape'
  shape: ShapeKind
  /** The drag's two points, in the layer's own space — its origin is its box's top-left corner. */
  from: Point
  to: Point
  /** Vertex count for the polygon and point count for the star; the four others ignore it. */
  sides: number
  /** `null` leaves the inside empty, which is what an outlined rectangle is. */
  fill: number | null
  stroke: ShapeStroke | null
}

export const DEFAULT_SHAPE_SIDES = 5

/** A shape without the layer around it: what the hand drew, before the stack names and places it. */
export type DrawnShape = Pick<ShapeLayer, 'shape' | 'from' | 'to' | 'sides' | 'fill' | 'stroke'>

export function shapeLayer(id: string, name: string, at: Point, drawn: DrawnShape): ShapeLayer {
  return {
    ...layerBase(id, name),
    kind: 'shape',
    ...drawn,
    transform: { ...IDENTITY, x: at.x, y: at.y },
  }
}

export type Layer = PixelLayer | GroupLayer | AdjustmentLayer | TextLayer | ShapeLayer

export type LayerKind = Layer['kind']

/** All of them: the inspector names each one from a bundle, and a nameless one shows its key. */
export const LAYER_KINDS: readonly LayerKind[] = ['pixel', 'group', 'adjustment', 'text', 'shape']

export const GUIDE_AXES: readonly Guide['axis'][] = ['x', 'y']

export type Guide = {
  id: string
  axis: 'x' | 'y'
  /** Document coordinates, so a guide keeps its place through zoom and pan. */
  position: number
}

export const WHITE = 0xffffff

export type ColorMode = 'rgb' | 'grayscale'

export const COLOR_MODES: readonly ColorMode[] = ['rgb', 'grayscale']
export type BitDepth = 8 | 16 | 32

export const BIT_DEPTHS: readonly BitDepth[] = [8, 16, 32]

export type CanvasState = {
  width: number
  height: number
  /** 72 for the screen, 300 for print. Carried for export, never used to lay anything out. */
  dpi: number
  colorMode: ColorMode
  bitDepth: BitDepth
  /** How many document pixels wide one square of the artwork is. `null` for no grid at all. */
  pixelCell: number | null
  /** Bottom first, so the last one is what the eye sees on top. */
  layers: Layer[]
  activeLayerId: string | null
  guides: Guide[]
}

/**
 * Every field a layer of any kind carries, at its default. Spelled once: a caller that forgets
 * one gets a layer the compositor treats differently for no visible reason.
 */
export function layerBase(id: string, name: string): Omit<LayerBase, never> {
  return {
    id,
    name,
    visible: true,
    locked: UNLOCKED,
    opacity: 1,
    fillOpacity: 1,
    blend: 'normal',
    clipped: false,
    transform: IDENTITY,
  }
}

export function pixelLayer(id: string, name: string, fill?: number): PixelLayer {
  return { ...layerBase(id, name), kind: 'pixel', fill }
}

export function groupLayer(id: string, name: string, children: Layer[]): GroupLayer {
  return {
    ...layerBase(id, name),
    kind: 'group',
    children,
    collapsed: false,
    isolation: 'pass-through',
  }
}

/**
 * The white page a new document opens on. It is a real layer, not a background colour: it can
 * be hidden, faded or deleted like any other, and the transparency checker shows through it.
 */
const BASE_LAYER: PixelLayer = pixelLayer('layer-1', 'Background', WHITE)

/** A new document opens with one layer, already active: a canvas you cannot paint on is a bug. */
export const DEFAULT_CANVAS: CanvasState = {
  width: 1024,
  height: 1024,
  dpi: 72,
  colorMode: 'rgb',
  bitDepth: 8,
  pixelCell: null,
  layers: [BASE_LAYER],
  activeLayerId: BASE_LAYER.id,
  guides: [],
}

/**
 * Whether the layer's texture is rebuilt from its state rather than held as its pixels. A caption
 * and a shape are, so a document-wide turn cannot be left to their surfaces: the next redraw
 * would lay them out flat again, under a transform conjugated for pixels that turned.
 */
export function isRedrawn(layer: Layer): layer is TextLayer | ShapeLayer {
  return layer.kind === 'text' || layer.kind === 'shape'
}

export {
  allLayers,
  canMaskFromSelection,
  canMergeDown,
  canMoveLayer,
  canRemoveLayer,
  clampOpacity,
  isGroup,
  layerBelow,
  layerById,
  mapLayers,
  serializeCanvas,
  updateSiblings,
} from './canvasStateTree'
