/**
 * Radiance RGBE — the `.hdr` file, written by hand.
 *
 * Forty lines and no dependency, against a parser three ships and an encoder it does not. The
 * format is a text header, a resolution line, then one byte each for red, green, blue and a
 * SHARED exponent: three mantissas and one power of two, which is what buys a picture far more
 * range than eight bits a channel while staying eight bits a channel.
 *
 * Written FLAT — no run-length pass. The spec makes the compressed scanline optional and every
 * reader takes both, and a picture whose pixels barely repeat is what a sky is.
 */

/** What Radiance opens on, and the only variant this writes. `-Y` then `+X` is the usual order. */
const HEADER = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n'

/**
 * One pixel, as four bytes. The exponent is the one that holds the LARGEST of the three channels:
 * scaled by it, none of the three can overflow its byte.
 *
 * `frexp` by hand, which JavaScript does not have: `Math.log2` then `Math.ceil` answers the same
 * power of two, and the mantissa is what the division leaves.
 */
function rgbeOf(red: number, green: number, blue: number, into: Uint8Array, at: number): void {
  const brightest = Math.max(red, green, blue)

  // Black, and anything a float turned into a NaN on the way: four zeros is how Radiance spells
  // a pixel of nothing, and a NaN written raw makes a file no reader recovers from.
  if (!(brightest > 1e-32)) {
    into[at] = 0
    into[at + 1] = 0
    into[at + 2] = 0
    into[at + 3] = 0
    return
  }

  const exponent = Math.ceil(Math.log2(brightest))
  const scale = 256 / Math.pow(2, exponent)

  into[at] = Math.min(255, Math.floor(red * scale))
  into[at + 1] = Math.min(255, Math.floor(green * scale))
  into[at + 2] = Math.min(255, Math.floor(blue * scale))
  // Biased by 128, which is what lets one byte carry an exponent that goes both ways.
  into[at + 3] = Math.min(255, Math.max(0, exponent + 128))
}

/**
 * One half float, as three's `DataUtils.fromHalfFloat` reads it — spelt here because `shared/`
 * carries no runtime dependency. Checked against three on all 65 536 patterns, 2026-08-20.
 */
function fromHalfFloat(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1
  const exponent = (bits & 0x7c00) >> 10
  const fraction = bits & 0x03ff

  // Subnormals and zero share the empty exponent; the encoder writes both as black either way.
  if (exponent === 0) return sign * Math.pow(2, -24) * fraction
  if (exponent === 0x1f) return fraction ? Number.NaN : sign * Infinity
  return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024)
}

/**
 * Every half float there is, 256 KiB of them: converting one by one cost 570 ms at 4K against
 * 265 through the table, and the whole point was to spend less, not to spend it differently.
 */
const HALF_FLOATS = Float32Array.from({ length: 0x10000 }, (_unused, bits) => fromHalfFloat(bits))

/**
 * A `.hdr` file of `pixels`, which is RGBA in the layout a render target reads back — row zero at
 * the BOTTOM, as OpenGL counts. The `-Y` header says top-first, so the rows are written in
 * reverse: a sky written the other way up is the defect a viewer shows and no test would.
 *
 * Half floats are taken as they come off a half-float target, and that is the point: materialising
 * them as `Float32Array` first held the same picture twice — 224 MiB in flight for a 4K panorama
 * against 96, and 896 against 384 at 8K — for 265 ms against 235, measured 2026-08-20.
 *
 * Alpha is dropped, and it is not an omission: Radiance has no fourth channel to put it in.
 */
export function encodeRgbe(
  pixels: Float32Array | Uint16Array,
  width: number,
  height: number,
): Uint8Array {
  const header = new TextEncoder().encode(`${HEADER}-Y ${height} +X ${width}\n`)
  const file = new Uint8Array(header.length + width * height * 4)
  file.set(header)

  const half = pixels instanceof Uint16Array
  const valueAt = (index: number): number =>
    half ? (HALF_FLOATS[pixels[index] ?? 0] ?? 0) : (pixels[index] ?? 0)

  let at = header.length
  for (let row = height - 1; row >= 0; row -= 1) {
    for (let column = 0; column < width; column += 1) {
      const from = (row * width + column) * 4
      rgbeOf(valueAt(from), valueAt(from + 1), valueAt(from + 2), file, at)
      at += 4
    }
  }
  return file
}
