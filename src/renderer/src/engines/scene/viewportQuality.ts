/**
 * What a quality level actually costs, in the one currency a viewport spends: device pixels per
 * CSS pixel.
 *
 * Nothing about the assets moves — no texture is resized, no geometry simplified — which is what
 * makes the setting safe to flip mid-session and reversible to the pixel.
 */
import type { ViewportQuality } from '@shared/domain/scene'

/**
 * `high` asks for more than any screen has, and the viewport holds it to the display's own: it
 * means « whatever this machine can show », not a number.
 */
const PIXEL_RATIOS: Record<ViewportQuality, number> = {
  performance: 1,
  balanced: 1.5,
  high: 4,
}

export function pixelRatioFor(quality: ViewportQuality): number {
  return PIXEL_RATIOS[quality]
}

/** How large a shadow map a level will pay for. Doubling a side costs four times the memory. */
const SHADOW_CEILINGS: Record<ViewportQuality, number> = {
  performance: 512,
  balanced: 2048,
  high: 4096,
}

/**
 * The side of the shadow map a light actually gets: what the person asked for, capped by what the
 * quality level pays for.
 *
 * A CAP rather than a value of its own, so the two settings compose instead of overriding each
 * other — someone who chose 1024 keeps 1024 on `high`, and is not silently given 4096.
 */
export function shadowMapSizeFor(quality: ViewportQuality, preferred: number): number {
  return Math.min(preferred, SHADOW_CEILINGS[quality])
}
