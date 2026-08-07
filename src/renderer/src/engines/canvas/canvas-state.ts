/**
 * An image document, as plain data. It holds no Pixi object on purpose: an engine is rebuilt
 * from its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 *
 * Pixels are NOT here — they live in a GPU texture per layer, owned by `CanvasEngine`. This is
 * what a layer *is*, not what it shows.
 */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay'

export type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  /** 0 to 1. */
  opacity: number
  blend: BlendMode
}

export type CanvasState = {
  width: number
  height: number
  /** Bottom first, so the last one is what the eye sees on top. */
  layers: Layer[]
  activeLayerId: string | null
}

export const BLEND_MODES: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay']

const BASE_LAYER: Layer = {
  id: 'layer-1',
  name: 'Layer 1',
  visible: true,
  locked: false,
  opacity: 1,
  blend: 'normal',
}

/** A new document opens with one layer, already active: a canvas you cannot paint on is a bug. */
export const DEFAULT_CANVAS: CanvasState = {
  width: 1024,
  height: 1024,
  layers: [BASE_LAYER],
  activeLayerId: BASE_LAYER.id,
}

export function layerById(state: CanvasState, id: string): Layer | null {
  return state.layers.find(layer => layer.id === id) ?? null
}

export function clampOpacity(value: number): number {
  if (Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export function serializeCanvas(state: CanvasState): string {
  return JSON.stringify(state)
}

/** Unreadable input yields a fresh document: a blank canvas beats an uncaught throw. */
export function deserializeCanvas(raw: string): CanvasState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CANVAS

    const { width, height, layers, activeLayerId } = parsed as Partial<CanvasState>
    if (!Array.isArray(layers) || layers.length === 0) return DEFAULT_CANVAS

    return {
      width: typeof width === 'number' ? width : DEFAULT_CANVAS.width,
      height: typeof height === 'number' ? height : DEFAULT_CANVAS.height,
      layers,
      activeLayerId: typeof activeLayerId === 'string' ? activeLayerId : (layers[0]?.id ?? null),
    }
  } catch {
    return DEFAULT_CANVAS
  }
}
