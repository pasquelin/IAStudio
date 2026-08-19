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
 * A `.hdr` file of `pixels`, which is RGBA floats in the layout a render target reads back — row
 * zero at the BOTTOM, as OpenGL counts. The `-Y` header says top-first, so the rows are written
 * in reverse: a sky written the other way up is the defect a viewer shows and no test would.
 *
 * Alpha is dropped, and it is not an omission: Radiance has no fourth channel to put it in.
 */
export function encodeRgbe(pixels: Float32Array, width: number, height: number): Uint8Array {
  const header = new TextEncoder().encode(`${HEADER}-Y ${height} +X ${width}\n`)
  const file = new Uint8Array(header.length + width * height * 4)
  file.set(header)

  let at = header.length
  for (let row = height - 1; row >= 0; row -= 1) {
    for (let column = 0; column < width; column += 1) {
      const from = (row * width + column) * 4
      rgbeOf(pixels[from] ?? 0, pixels[from + 1] ?? 0, pixels[from + 2] ?? 0, file, at)
      at += 4
    }
  }
  return file
}
