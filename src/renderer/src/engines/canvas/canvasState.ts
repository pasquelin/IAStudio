import {
  NEUTRAL_ADJUSTMENTS,
  readAdjustments,
  type AdjustmentStack,
} from '@shared/domain/adjustments'
import { DEFAULT_FONT, readFontRef, type FontRef } from '@shared/domain/font'
import { isRecord } from '@shared/guards'
import { clamp } from '@shared/numeric'
import type { Point } from '../core/geometry'

/**
 * An image document, as plain data. It holds no Pixi object on purpose: an engine is rebuilt
 * from its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 *
 * Pixels are NOT here — they live in a GPU texture per layer, owned by `CanvasEngine` and keyed
 * by layer id. This is what a layer *is*, not what it shows.
 */

/** The Porter-Duff and separable modes Pixi can composite with. */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]

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

const GROUP_ISOLATIONS: readonly GroupIsolation[] = ['pass-through', 'isolate']

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
}

export const DEFAULT_TEXT_SIZE = 48

export function textLayer(id: string, text: string, at: Point): TextLayer {
  return {
    ...layerBase(id, text),
    kind: 'text',
    text,
    font: DEFAULT_FONT,
    size: DEFAULT_TEXT_SIZE,
    color: 0x000000,
    transform: { ...IDENTITY, x: at.x, y: at.y },
  }
}

export type Layer = PixelLayer | GroupLayer | AdjustmentLayer | TextLayer

export type LayerKind = Layer['kind']

/** All of them: the inspector names each one from a bundle, and a nameless one shows its key. */
export const LAYER_KINDS: readonly LayerKind[] = ['pixel', 'group', 'adjustment', 'text']

const GUIDE_AXES: readonly ('x' | 'y')[] = ['x', 'y']

export type Guide = {
  id: string
  axis: 'x' | 'y'
  /** Document coordinates, so a guide keeps its place through zoom and pan. */
  position: number
}

export const WHITE = 0xffffff

export type ColorMode = 'rgb' | 'grayscale'

const COLOR_MODES: readonly ColorMode[] = ['rgb', 'grayscale']
export type BitDepth = 8 | 16 | 32

export type CanvasState = {
  width: number
  height: number
  /** 72 for the screen, 300 for print. Carried for export, never used to lay anything out. */
  dpi: number
  colorMode: ColorMode
  bitDepth: BitDepth
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
  layers: [BASE_LAYER],
  activeLayerId: BASE_LAYER.id,
  guides: [],
}

export function isGroup(layer: Layer): layer is GroupLayer {
  return layer.kind === 'group'
}

/**
 * Every layer of the stack, groups included, depth first and bottom first. Groups nest, so no
 * caller may assume `state.layers` is the whole document.
 */
export function allLayers(layers: readonly Layer[]): Layer[] {
  return layers.flatMap(layer => (isGroup(layer) ? [layer, ...allLayers(layer.children)] : [layer]))
}

export function layerById(state: CanvasState, id: string | null): Layer | null {
  if (id === null) return null
  return allLayers(state.layers).find(layer => layer.id === id) ?? null
}

/**
 * The layers sharing a parent with `id`, rebuilt by `change`. Grouping made every neighbour
 * operation — reorder, merge down, duplicate — a question about one level of the tree, not about
 * `state.layers`, which is only the root.
 *
 * Returns the tree unchanged when nothing carries that id.
 */
export function updateSiblings(
  layers: readonly Layer[],
  id: string,
  change: (siblings: readonly Layer[], index: number) => Layer[],
): Layer[] {
  const index = layers.findIndex(layer => layer.id === id)
  if (index >= 0) return change(layers, index)

  return layers.map(layer =>
    isGroup(layer) ? { ...layer, children: updateSiblings(layer.children, id, change) } : layer,
  )
}

/**
 * Whether the stack would still hold something to paint on once `layer` leaves it — its whole
 * subtree, for a group.
 *
 * Counting the paintable layers of the document is not enough, and that is the trap this exists
 * for: a folder holding every pixel layer answers "two paintable" while deleting it empties the
 * document. `deserializeCanvas` reads an empty stack back as `DEFAULT_CANVAS`, silently resetting
 * the size, the colour mode and the bit depth of the picture.
 *
 * Read from both sides on purpose: `removeLayer` refuses the command, and the panel greys the
 * button and the menu row rather than offering a gesture that would do nothing.
 */
export function canRemoveLayer(layers: readonly Layer[], layer: Layer): boolean {
  const leaving = new Set(allLayers([layer]).map(one => one.id))

  return allLayers(layers).some(one => !isGroup(one) && !leaving.has(one.id))
}

/**
 * Whether a layer may hang at that level: under a GROUP, never under itself, and never under one
 * of its own descendants — the last would cut the branch out of the tree.
 *
 * Read from both sides like `canRemoveLayer`: `moveLayer` refuses the command by handing the state
 * back untouched, and a caller that cannot tell that apart from a move reports every miss as done.
 */
export function canMoveLayer(state: CanvasState, id: string, parentId: string | null): boolean {
  const layer = layerById(state, id)
  if (!layer) return false
  if (parentId === null) return true
  if (parentId === id) return false

  const parent = layerById(state, parentId)
  if (!parent || !isGroup(parent)) return false

  return !(isGroup(layer) && allLayers(layer.children).some(child => child.id === parentId))
}

/**
 * The layer directly under `id` at its own level — what `mergeDown` merges into. Within the level,
 * never through the wall of the group it sits in, exactly as the command reads it.
 *
 * `null` when it is the bottom of its level, or when nothing carries that id: there is nothing to
 * merge into, and the caller has to offer nothing rather than a menu entry that does nothing.
 */
export function layerBelow(layers: readonly Layer[], id: string): Layer | null {
  const index = layers.findIndex(layer => layer.id === id)
  if (index >= 0) return layers[index - 1] ?? null

  for (const layer of layers) {
    if (!isGroup(layer)) continue
    const found = layerBelow(layer.children, id)
    if (found) return found
  }
  return null
}

/** Rebuilds the tree with one layer replaced, wherever it sits. `null` removes it. */
export function mapLayers(
  layers: readonly Layer[],
  change: (layer: Layer) => Layer | null,
): Layer[] {
  const next: Layer[] = []
  for (const layer of layers) {
    const changed = change(layer)
    if (changed === null) continue
    next.push(
      isGroup(changed) ? { ...changed, children: mapLayers(changed.children, change) } : changed,
    )
  }
  return next
}

export function clampOpacity(value: number): number {
  if (Number.isNaN(value)) return 1
  return clamp(value, 0, 1)
}

export function serializeCanvas(state: CanvasState): string {
  return JSON.stringify(state)
}

/** A stored value narrowed back to what this build still accepts. */
function oneOf<T extends string>(options: readonly T[], raw: unknown, fallback: T): T {
  return options.find(option => option === raw) ?? fallback
}

/**
 * A layer read back from a file written by an older build. The stack predates `kind`, granular
 * locks and transforms, and a document saved then must still open — silently, with the same
 * pixels, not as an error dialog.
 */
function reviveLayer(raw: unknown, seen: Set<string>): Layer | null {
  if (!isRecord(raw)) return null
  const source = raw
  if (typeof source.id !== 'string') return null

  const base = {
    id: source.id,
    name: typeof source.name === 'string' ? source.name : source.id,
    visible: source.visible !== false,
    locked: reviveLocks(source.locked),
    opacity: typeof source.opacity === 'number' ? clampOpacity(source.opacity) : 1,
    fillOpacity: typeof source.fillOpacity === 'number' ? clampOpacity(source.fillOpacity) : 1,
    blend: oneOf(BLEND_MODES, source.blend, 'normal'),
    clipped: source.clipped === true,
    transform: reviveTransform(source.transform),
    mask: reviveMask(source.mask),
  }

  if (source.kind === 'group') {
    return {
      ...base,
      kind: 'group',
      children: Array.isArray(source.children) ? reviveLayers(source.children, seen) : [],
      collapsed: source.collapsed === true,
      isolation: oneOf(GROUP_ISOLATIONS, source.isolation, 'pass-through'),
    }
  }

  if (source.kind === 'text') {
    return {
      ...base,
      kind: 'text',
      text: typeof source.text === 'string' ? source.text : '',
      // Read rather than trusted, exactly as a scene reads a text node's face: a family the
      // studio no longer ships falls back to one it does.
      font: readFontRef(source.font),
      size: typeof source.size === 'number' ? source.size : DEFAULT_TEXT_SIZE,
      color: typeof source.color === 'number' ? source.color : 0x000000,
    }
  }

  if (source.kind === 'adjustment') {
    return {
      ...base,
      kind: 'adjustment',
      adjustment: reviveAdjustment(source.adjustment),
      values: readAdjustments(source.values),
    }
  }

  // No `kind` at all is the pre-groups format, where every layer was a pixel layer.
  return {
    ...base,
    kind: 'pixel',
    fill: typeof source.fill === 'number' ? source.fill : undefined,
    source: typeof source.source === 'string' ? source.source : undefined,
  }
}

/**
 * `seen` spans the whole file, not one level: every lookup and every edit matches by id across
 * the tree, so two layers sharing one would be renamed, hidden and painted together — and
 * removing "it" would empty the stack the last-layer guard exists to protect.
 */
function reviveLayers(raw: readonly unknown[], seen: Set<string>): Layer[] {
  return raw.flatMap(entry => {
    const layer = reviveLayer(entry, seen)
    if (!layer || seen.has(layer.id)) return []
    seen.add(layer.id)
    return [layer]
  })
}

function reviveLocks(raw: unknown): LayerLocks {
  // One boolean was the whole padlock before: it meant "nothing about this layer moves".
  if (raw === true) return { pixels: true, position: true, alpha: true }
  if (!isRecord(raw)) return UNLOCKED
  return {
    pixels: raw.pixels === true,
    position: raw.position === true,
    alpha: raw.alpha === true,
  }
}

/**
 * What the four kinds a document may have been saved with became. `levels` and `curves` both
 * graded tone and `colorBalance` graded colour, so each lands on the dial that does its job —
 * a document written by an older build opens showing something, never an empty row.
 */
const RETIRED_ADJUSTMENTS: Readonly<Record<string, AdjustmentKind>> = {
  levels: 'exposure',
  curves: 'contrast',
  hsl: 'saturation',
  colorBalance: 'temperature',
}

function reviveAdjustment(raw: unknown): AdjustmentKind {
  if (typeof raw === 'string' && raw in RETIRED_ADJUSTMENTS) {
    return RETIRED_ADJUSTMENTS[raw] ?? 'exposure'
  }
  return oneOf(ADJUSTMENT_KINDS, raw, 'exposure')
}

function reviveTransform(raw: unknown): Transform {
  if (!isRecord(raw)) return IDENTITY
  const source = raw
  const number = (key: keyof Transform): number =>
    typeof source[key] === 'number' ? source[key] : IDENTITY[key]

  return {
    x: number('x'),
    y: number('y'),
    scaleX: number('scaleX'),
    scaleY: number('scaleY'),
    rotation: number('rotation'),
    skewX: number('skewX'),
    skewY: number('skewY'),
    originX: number('originX'),
    originY: number('originY'),
  }
}

function reviveMask(raw: unknown): { enabled: boolean; linked: boolean } | undefined {
  if (!isRecord(raw)) return undefined
  const source = raw
  return { enabled: source.enabled !== false, linked: source.linked !== false }
}

function reviveGuides(raw: unknown): Guide[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(entry => {
    if (!isRecord(entry)) return []
    const source = entry
    if (typeof source.id !== 'string' || typeof source.position !== 'number') return []
    return [{ id: source.id, axis: oneOf(GUIDE_AXES, source.axis, 'x'), position: source.position }]
  })
}

/** Unreadable input yields a fresh document: a blank canvas beats an uncaught throw. */
export function deserializeCanvas(raw: string): CanvasState {
  try {
    const source: unknown = JSON.parse(raw)
    if (!isRecord(source)) return DEFAULT_CANVAS
    const layers = Array.isArray(source.layers) ? reviveLayers(source.layers, new Set()) : []
    if (layers.length === 0) return DEFAULT_CANVAS

    const active = source.activeLayerId
    // Paintable, not merely present: a group has no texture of its own, so arming one would
    // swallow every stroke silently.
    const known = allLayers(layers).some(layer => layer.id === active && !isGroup(layer))

    return {
      width: typeof source.width === 'number' ? source.width : DEFAULT_CANVAS.width,
      height: typeof source.height === 'number' ? source.height : DEFAULT_CANVAS.height,
      dpi: typeof source.dpi === 'number' ? source.dpi : DEFAULT_CANVAS.dpi,
      colorMode: oneOf(COLOR_MODES, source.colorMode, 'rgb'),
      bitDepth: source.bitDepth === 16 || source.bitDepth === 32 ? source.bitDepth : 8,
      layers,
      // An id naming no layer would leave the document unpaintable, with no way back.
      activeLayerId:
        known && typeof active === 'string'
          ? active
          : (allLayers(layers).find(layer => !isGroup(layer))?.id ?? null),
      guides: reviveGuides(source.guides),
    }
  } catch {
    return DEFAULT_CANVAS
  }
}
