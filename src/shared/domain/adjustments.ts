/**
 * Non-destructive colour grading, shared by every workspace that judges an image rather than
 * edits it. It is a description, never pixels: the stack travels with the document, the GPU
 * applies it on the way to the screen, and the source file on disk is never rewritten.
 *
 * This is the product argument of the studio — a competitor charges another generation for
 * what a uniform costs here — so nothing in this type may become a baked file by accident.
 */
export type AdjustmentStack = {
  /** Exposure in stops. Multiplies by `2 ** exposure`, so 0 is untouched. */
  exposure: number
  /** 1 is untouched. Below 1 flattens, above 1 hardens. */
  contrast: number
  /** 1 is untouched. 0 is greyscale. */
  saturation: number
  /** -1 cold, 0 untouched, +1 warm. */
  temperature: number
  /** -1 green, 0 untouched, +1 magenta. */
  tint: number
  /** Radians. Horizon rotation for a sky, UV rotation for a texture. */
  rotationY: number
  /** 0 sharp, 1 fully softened. */
  blur: number
}

export const NEUTRAL_ADJUSTMENTS: AdjustmentStack = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  tint: 0,
  rotationY: 0,
  blur: 0,
}

/**
 * Whether the stack changes nothing. Worth asking: a neutral stack lets the export skip its
 * GPU pass and copy the source file untouched, which is both faster and lossless.
 */
export function isNeutral(stack: AdjustmentStack): boolean {
  return (
    stack.exposure === NEUTRAL_ADJUSTMENTS.exposure &&
    stack.contrast === NEUTRAL_ADJUSTMENTS.contrast &&
    stack.saturation === NEUTRAL_ADJUSTMENTS.saturation &&
    stack.temperature === NEUTRAL_ADJUSTMENTS.temperature &&
    stack.tint === NEUTRAL_ADJUSTMENTS.tint &&
    stack.rotationY === NEUTRAL_ADJUSTMENTS.rotationY &&
    stack.blur === NEUTRAL_ADJUSTMENTS.blur
  )
}
