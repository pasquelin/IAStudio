/**
 * Non-destructive colour grading, shared by every workspace that judges an image rather than
 * edits it. It is a description, never pixels: the stack travels with the document, the GPU
 * applies it on the way to the screen, and the source file on disk is never rewritten.
 *
 * This is the product argument of the studio — a competitor charges another generation for
 * what a uniform costs here — so nothing in this type may become a baked file by accident.
 */
import { isRecord } from '../guards'

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

/**
 * A stack read back from a file: every dial narrowed to a number, missing ones left neutral.
 *
 * Here rather than beside a reader, because two documents hold this same stack — a layer of the
 * image and the sky itself — and a dial added to the type has to reach both.
 */
export function readAdjustments(raw: unknown): AdjustmentStack {
  if (!isRecord(raw)) return NEUTRAL_ADJUSTMENTS
  const source = raw

  const number = (key: keyof AdjustmentStack): number =>
    typeof source[key] === 'number' ? source[key] : NEUTRAL_ADJUSTMENTS[key]

  return {
    exposure: number('exposure'),
    contrast: number('contrast'),
    saturation: number('saturation'),
    temperature: number('temperature'),
    tint: number('tint'),
    rotationY: number('rotationY'),
    blur: number('blur'),
  }
}

/** How far a full swing of the temperature or tint slider pushes a channel. */
const TEMPERATURE_GAIN = 0.25
const TINT_GAIN = 0.15

const TWO_PI = Math.PI * 2

/**
 * The uniforms a stack becomes. Here rather than beside either shader: three.js grades skies and
 * Pixi grades layers, and a grading contract written twice drifts. Pure arithmetic, so the two
 * conversions that are not identities — stops into a multiplier, radians into a texture offset —
 * are testable without a GL context.
 */
export function adjustUniformsOf(stack: AdjustmentStack): {
  exposure: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  offsetU: number
} {
  return {
    // Stops are doublings, which is what makes +1 EV mean "twice the light" rather than "one
    // more unit of it".
    exposure: 2 ** stack.exposure,
    contrast: stack.contrast,
    saturation: stack.saturation,
    temperature: stack.temperature * TEMPERATURE_GAIN,
    tint: stack.tint * TINT_GAIN,
    // A full turn is the whole width of an equirectangular picture.
    offsetU: stack.rotationY / TWO_PI,
  }
}
