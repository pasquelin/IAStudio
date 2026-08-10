/**
 * What a render is made of, apart from the GPU that draws it.
 *
 * These two are pure on purpose: there is no WebGL under vitest, so the schedule of a film and
 * the way its pixels come back are the parts that can actually be held to account.
 */

/**
 * The instant of every frame of a film, first one at zero.
 *
 * Counted rather than accumulated: adding 1/fps over and over drifts, and a film of a thousand
 * frames would end measurably late. A duration that is not a whole number of frames is rounded
 * UP, so the last moment of the timeline is shown rather than cut.
 */
export function frameTimes(duration: number, fps: number): number[] {
  if (duration <= 0 || fps <= 0) return []

  const count = Math.max(1, Math.round(duration * fps))
  return Array.from({ length: count }, (_, index) => index / fps)
}

/**
 * WebGL reads its pixels bottom-up, a canvas writes them top-down. Without this every frame of
 * a film is upside down — and it is the kind of thing nobody notices until the film is watched.
 */
export function flipRows(pixels: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const stride = width * 4
  const flipped = new Uint8ClampedArray(pixels.length)

  for (let row = 0; row < height; row += 1) {
    const from = row * stride
    const to = (height - row - 1) * stride
    flipped.set(pixels.subarray(from, from + stride), to)
  }
  return flipped
}

/** What a film is asked for. The size is the film's, never the viewport's. */
export type FilmRequest = {
  width: number
  height: number
  fps: number
  duration: number
}

/** Sizes that are not even are refused by H.264 encoders, so they are rounded here instead. */
export function evenSize(request: FilmRequest): { width: number; height: number } {
  return {
    width: Math.max(2, Math.round(request.width / 2) * 2),
    height: Math.max(2, Math.round(request.height / 2) * 2),
  }
}
