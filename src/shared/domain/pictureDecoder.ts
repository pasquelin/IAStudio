/**
 * Which decoder a picture needs, or nothing when the browser is one — read from its BYTES.
 *
 * From the bytes for the reason `meshFormatOf` is: a picture reaches the engines as
 * `ia-studio://asset/<id>`, which spells no extension. And it has to be asked at all because
 * handed to an `<img>`, every one of these lands as a picture of nothing — silently.
 */
export type PictureDecoder = 'radiance' | 'openexr' | 'tiff'

/** `0x76 0x2f 0x31 0x01`, the four bytes an OpenEXR file opens on. */
const OPENEXR = [0x76, 0x2f, 0x31, 0x01]

/** `II` little-endian or `MM` big-endian, then 42 — the version TIFF has always spelled. */
const TIFF = [
  [0x49, 0x49, 0x2a, 0x00],
  [0x4d, 0x4d, 0x00, 0x2a],
]

const opensOn = (bytes: Uint8Array, magic: readonly number[]): boolean =>
  magic.every((byte, at) => bytes[at] === byte)

export function decoderFor(bytes: Uint8Array): PictureDecoder | null {
  if (opensOn(bytes, OPENEXR)) return 'openexr'
  if (TIFF.some(magic => opensOn(bytes, magic))) return 'tiff'

  // `#?RADIANCE` is the usual line, `#?RGBE` the one older writers put there. Both are Radiance.
  const head = new TextDecoder().decode(bytes.subarray(0, 16))
  return head.startsWith('#?RADIANCE') || head.startsWith('#?RGBE') ? 'radiance' : null
}
