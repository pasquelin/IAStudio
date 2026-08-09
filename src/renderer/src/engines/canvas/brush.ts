import { clamp } from '@/helpers/numeric'

/**
 * What the brush, the eraser and the shape stroke are set to. Session state, not document
 * state: it is held by React and pushed into the engine, which never reads it back.
 *
 * It lives here rather than beside the engine so that the toolbar can name it without pulling
 * Pixi into a test that only wanted a number.
 */
export type BrushSettings = {
  /** A diameter, in document pixels. */
  size: number
  /** 0 to 1. 1 is a hard edge, 0 a fully feathered one. */
  hardness: number
  opacity: number
  /** Packed RGB, the form Pixi takes. */
  color: number
}

/**
 * One pixel to five hundred and twelve. The floor is the smallest dab that leaves a mark; the
 * ceiling is half a 1024 document, past which a brush stops being a brush and becomes a fill.
 */
export const BRUSH_SIZE = { min: 1, max: 512 }

export const DEFAULT_BRUSH: BrushSettings = {
  size: 24,
  hardness: 0.8,
  opacity: 1,
  color: 0x000000,
}

/**
 * A step of the scale, as a ratio rather than a count of pixels: a fixed step crawls at 400 px
 * and leaps at 4. Half an octave, which is what puts a handful of presses between the extremes.
 */
const STEP = Math.SQRT2

export function resizedBrush(brush: BrushSettings, towards: 'larger' | 'smaller'): BrushSettings {
  const from = clamp(brush.size, BRUSH_SIZE.min, BRUSH_SIZE.max)
  // At least a pixel either way: at the bottom of the scale the ratio rounds to a standstill,
  // and a key that does nothing reads as a broken key rather than as a floor.
  const stepped =
    towards === 'larger'
      ? Math.max(from + 1, Math.round(from * STEP))
      : Math.min(from - 1, Math.round(from / STEP))

  return { ...brush, size: clamp(stepped, BRUSH_SIZE.min, BRUSH_SIZE.max) }
}
