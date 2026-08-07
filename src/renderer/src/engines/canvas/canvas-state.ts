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

type LayerBase = {
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
}

/** `pass-through` lets an adjustment inside the group reach what is under the group. */
export type GroupIsolation = 'pass-through' | 'isolate'

export type GroupLayer = LayerBase & {
  kind: 'group'
  children: Layer[]
  collapsed: boolean
  isolation: GroupIsolation
}

export type AdjustmentKind = 'levels' | 'curves' | 'hsl' | 'colorBalance'

export type AdjustmentLayer = LayerBase & {
  kind: 'adjustment'
  adjustment: AdjustmentKind
}

export type Layer = PixelLayer | GroupLayer | AdjustmentLayer

export type Guide = {
  id: string
  axis: 'x' | 'y'
  /** Document coordinates, so a guide keeps its place through zoom and pan. */
  position: number
}

export type ColorMode = 'rgb' | 'grayscale'
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

export const WHITE = 0xffffff

/**
 * The white page a new document opens on. It is a real layer, not a background colour: it can
 * be hidden, faded or deleted like any other, and the transparency checker shows through it.
 */
const BASE_LAYER: PixelLayer = {
  kind: 'pixel',
  id: 'layer-1',
  name: 'Background',
  visible: true,
  locked: UNLOCKED,
  opacity: 1,
  fillOpacity: 1,
  blend: 'normal',
  clipped: false,
  transform: IDENTITY,
  fill: WHITE,
}

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
  return Math.min(1, Math.max(0, value))
}

export function serializeCanvas(state: CanvasState): string {
  return JSON.stringify(state)
}

/**
 * A layer read back from a file written by an older build. The stack predates `kind`, granular
 * locks and transforms, and a document saved then must still open — silently, with the same
 * pixels, not as an error dialog.
 */
function reviveLayer(raw: unknown): Layer | null {
  if (!raw || typeof raw !== 'object') return null
  const source: Record<string, unknown> = { ...raw }
  if (typeof source.id !== 'string') return null

  const base = {
    id: source.id,
    name: typeof source.name === 'string' ? source.name : source.id,
    visible: source.visible !== false,
    locked: reviveLocks(source.locked),
    opacity: typeof source.opacity === 'number' ? clampOpacity(source.opacity) : 1,
    fillOpacity: typeof source.fillOpacity === 'number' ? clampOpacity(source.fillOpacity) : 1,
    blend: reviveBlend(source.blend),
    clipped: source.clipped === true,
    transform: reviveTransform(source.transform),
    mask: reviveMask(source.mask),
  }

  if (source.kind === 'group') {
    return {
      ...base,
      kind: 'group',
      children: Array.isArray(source.children) ? reviveLayers(source.children) : [],
      collapsed: source.collapsed === true,
      isolation: source.isolation === 'isolate' ? 'isolate' : 'pass-through',
    }
  }

  if (source.kind === 'adjustment') {
    return { ...base, kind: 'adjustment', adjustment: reviveAdjustment(source.adjustment) }
  }

  // No `kind` at all is the pre-groups format, where every layer was a pixel layer.
  return { ...base, kind: 'pixel', fill: typeof source.fill === 'number' ? source.fill : undefined }
}

function reviveLayers(raw: readonly unknown[]): Layer[] {
  return raw.flatMap(entry => {
    const layer = reviveLayer(entry)
    return layer ? [layer] : []
  })
}

function reviveLocks(raw: unknown): LayerLocks {
  // One boolean was the whole padlock before: it meant "nothing about this layer moves".
  if (raw === true) return { pixels: true, position: true, alpha: true }
  if (!raw || typeof raw !== 'object') return UNLOCKED

  const source: Record<string, unknown> = { ...raw }
  return {
    pixels: source.pixels === true,
    position: source.position === true,
    alpha: source.alpha === true,
  }
}

function reviveBlend(raw: unknown): BlendMode {
  return BLEND_MODES.find(mode => mode === raw) ?? 'normal'
}

const ADJUSTMENT_KINDS: readonly AdjustmentKind[] = ['levels', 'curves', 'hsl', 'colorBalance']

function reviveAdjustment(raw: unknown): AdjustmentKind {
  return ADJUSTMENT_KINDS.find(kind => kind === raw) ?? 'levels'
}

function reviveTransform(raw: unknown): Transform {
  if (!raw || typeof raw !== 'object') return IDENTITY
  const source: Record<string, unknown> = { ...raw }
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
  if (!raw || typeof raw !== 'object') return undefined
  const source: Record<string, unknown> = { ...raw }
  return { enabled: source.enabled !== false, linked: source.linked !== false }
}

function reviveGuides(raw: unknown): Guide[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return []
    const source: Record<string, unknown> = { ...entry }
    if (typeof source.id !== 'string' || typeof source.position !== 'number') return []
    return [{ id: source.id, axis: source.axis === 'y' ? 'y' : 'x', position: source.position }]
  })
}

/** Unreadable input yields a fresh document: a blank canvas beats an uncaught throw. */
export function deserializeCanvas(raw: string): CanvasState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CANVAS

    const source: Record<string, unknown> = { ...parsed }
    const layers = Array.isArray(source.layers) ? reviveLayers(source.layers) : []
    if (layers.length === 0) return DEFAULT_CANVAS

    const active = source.activeLayerId
    const known = allLayers(layers).some(layer => layer.id === active)

    return {
      width: typeof source.width === 'number' ? source.width : DEFAULT_CANVAS.width,
      height: typeof source.height === 'number' ? source.height : DEFAULT_CANVAS.height,
      dpi: typeof source.dpi === 'number' ? source.dpi : DEFAULT_CANVAS.dpi,
      colorMode: source.colorMode === 'grayscale' ? 'grayscale' : 'rgb',
      bitDepth: source.bitDepth === 16 || source.bitDepth === 32 ? source.bitDepth : 8,
      layers,
      // An id naming no layer would leave the document unpaintable, with no way back.
      activeLayerId: known && typeof active === 'string' ? active : (layers[0]?.id ?? null),
      guides: reviveGuides(source.guides),
    }
  } catch {
    return DEFAULT_CANVAS
  }
}
