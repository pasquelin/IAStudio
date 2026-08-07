/**
 * How long the frame about to be drawn should be told it lasted.
 *
 * Out of `ViewportEngine` because that class cannot be built without a WebGL context, and this
 * is the part of it that has to be right: a fly step multiplies whatever comes out of here.
 */
export type FrameTiming = {
  /** Milliseconds of the previous frame, or `null` when the loop is starting from rest. */
  since: number | null
  /** Longest frame a step may be told about — a hidden window comes back with minutes. */
  cap: number
}

/**
 * Seconds, capped, and zero when the loop is waking up.
 *
 * A viewport at rest draws nothing, so the time since its last frame is however long the user
 * left it alone — not a frame duration. Handed to a fly step, a five-second gap moves the
 * camera five seconds' worth in one jump.
 */
export function frameDelta({ since, cap }: FrameTiming): number {
  if (since === null || since < 0) return 0
  return Math.min(since / 1000, cap)
}
