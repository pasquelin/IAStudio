/**
 * What a render is made of, apart from the GPU that draws it.
 *
 * These two are pure on purpose: there is no WebGL under vitest, so the schedule of a film and
 * the way its pixels come back are the parts that can actually be held to account.
 */
import { frameDuration, type Us } from '@shared/domain/time'

/**
 * The instant of every frame of a film, first one at zero.
 *
 * Counted rather than accumulated: adding 1/fps over and over drifts, and a film of a thousand
 * frames would end measurably late. A duration that is not a whole number of frames is rounded
 * UP, so the last moment of the timeline is shown rather than cut.
 */
export function frameTimes(duration: Us, fps: number): Us[] {
  if (duration <= 0 || fps <= 0) return []

  const frame = frameDuration(fps)
  const count = Math.max(1, Math.round(duration / frame))
  return Array.from({ length: count }, (_, index) => index * frame)
}

/**
 * WebGL reads its pixels bottom-up, a canvas writes them top-down. Without this every frame of
 * a film is upside down — and it is the kind of thing nobody notices until the film is watched.
 */
export function flipInto(
  into: Uint8ClampedArray,
  pixels: Uint8Array,
  width: number,
  height: number,
): void {
  const stride = width * 4

  for (let row = 0; row < height; row += 1) {
    const from = row * stride
    into.set(pixels.subarray(from, from + stride), (height - row - 1) * stride)
  }
}

/**
 * The 256 values of a linear channel, encoded to sRGB. Built once: the alternative is a `pow`
 * per subpixel, which is 25 million of them on a 4K still.
 */
const SRGB = new Uint8Array(256)
for (let value = 0; value < 256; value += 1) {
  const linear = value / 255
  const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055
  SRGB[value] = Math.round(encoded * 255)
}

/**
 * The same flip, encoding the colour on the way — for pixels read back out of a RENDER TARGET.
 *
 * three.js writes the working space into a target whatever its texture says (`WebGLRenderer`,
 * the colour space it picks for anything that is not the canvas), so those pixels are LINEAR
 * while a PNG is read as sRGB. Written straight out, a still comes back visibly washed out and
 * dark in the mid-tones.
 *
 * Alpha is left alone: it is linear by definition, and encoding it would make everything
 * transparent slightly opaque.
 */
export function flipToSrgbInto(
  into: Uint8ClampedArray,
  pixels: Uint8Array,
  width: number,
  height: number,
): void {
  const stride = width * 4

  for (let row = 0; row < height; row += 1) {
    const from = row * stride
    const to = (height - row - 1) * stride

    for (let at = 0; at < stride; at += 4) {
      into[to + at] = SRGB[pixels[from + at] ?? 0] ?? 0
      into[to + at + 1] = SRGB[pixels[from + at + 1] ?? 0] ?? 0
      into[to + at + 2] = SRGB[pixels[from + at + 2] ?? 0] ?? 0
      into[to + at + 3] = pixels[from + at + 3] ?? 0
    }
  }
}

/** The same, into a buffer of its own — what a test reads, and what a one-off caller wants. */
export function flipRows(pixels: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const flipped = new Uint8ClampedArray(pixels.length)
  flipInto(flipped, pixels, width, height)
  return flipped
}

/** What a film is asked for. The size is the film's, never the viewport's. */
export type FilmRequest = {
  width: number
  height: number
  fps: number
  duration: Us
}

/** Sizes that are not even are refused by H.264 encoders, so they are rounded here instead. */
export function evenSize(request: FilmRequest): { width: number; height: number } {
  return {
    width: Math.max(2, Math.round(request.width / 2) * 2),
    height: Math.max(2, Math.round(request.height / 2) * 2),
  }
}
