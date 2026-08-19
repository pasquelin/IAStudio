/**
 * Which high dynamic range picture a file is, from its bytes — `null` for every ordinary one.
 *
 * Read from the bytes for the reason `meshFormatOf` is: a picture reaches the engines as
 * `scenario://asset/<id>`, which spells no extension. And it has to be asked at all because no
 * browser decodes either of these: handed to an `<img>`, both land as a picture of nothing.
 */
export type HdrFormat = 'radiance' | 'openexr'

/** `0x76 0x2f 0x31 0x01`, the four bytes an OpenEXR file opens on. */
const OPENEXR = [0x76, 0x2f, 0x31, 0x01]

export function hdrFormatOf(bytes: Uint8Array): HdrFormat | null {
  if (OPENEXR.every((byte, at) => bytes[at] === byte)) return 'openexr'

  // `#?RADIANCE` is the usual line, `#?RGBE` the one older writers put there. Both are Radiance.
  const head = new TextDecoder().decode(bytes.subarray(0, 16))
  return head.startsWith('#?RADIANCE') || head.startsWith('#?RGBE') ? 'radiance' : null
}
