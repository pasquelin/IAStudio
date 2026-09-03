import type { PointerPosition } from './pointer'

/**
 * How far apart two fingers are — the reading a pinch dollies by, where their middle pans.
 *
 * Spelled here so the pair answers without a surface to put fingers on. In the shape the pointer
 * map holds, so a gesture that fires as fast as a hand moves allocates nothing to be measured.
 */
export function fingerGap(one: PointerPosition, other: PointerPosition): number {
  return Math.hypot(other.clientX - one.clientX, other.clientY - one.clientY)
}
