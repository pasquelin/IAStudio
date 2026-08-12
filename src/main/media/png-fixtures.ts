/**
 * A PNG opening: the eight-byte signature, then the IHDR chunk carrying the two dimensions.
 *
 * Here rather than in each suite because it is the SAME knowledge `probePng` parses — the byte
 * layout of a header. Written out twice, a misreading of it would be invisible: the fixture and
 * the parser would agree with each other and with nothing else.
 *
 * `trailing` pads the bytes so a case can say the header is read from the front of a real file
 * rather than from a buffer that happens to end there.
 */
export function pngBytes(options: {
  width: number
  height: number
  trailing?: number
}): Uint8Array {
  const bytes = new Uint8Array(24 + (options.trailing ?? 0))
  const view = new DataView(bytes.buffer)

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, options.width)
  view.setUint32(20, options.height)

  return bytes
}
