/**
 * A `.glb` built byte by byte, so what reads one can be tested against the real container
 * rather than against a shape someone believed it had.
 *
 * Shared because two suites need it: the parser's own, and the handler that writes what it
 * finds into a project.
 */
const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

/** Header, JSON chunk, binary chunk — each chunk padded to four bytes, as the format requires. */
export function glbFile(gltf: unknown, bin: Uint8Array = new Uint8Array()): Uint8Array {
  const json = padded(new TextEncoder().encode(JSON.stringify(gltf)), 0x20)
  const binary = padded(bin, 0)
  const total = 12 + 8 + json.byteLength + (binary.byteLength > 0 ? 8 + binary.byteLength : 0)

  const file = new Uint8Array(total)
  const view = new DataView(file.buffer)
  view.setUint32(0, GLB_MAGIC, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, json.byteLength, true)
  view.setUint32(16, JSON_CHUNK, true)
  file.set(json, 20)

  if (binary.byteLength > 0) {
    const at = 20 + json.byteLength
    view.setUint32(at, binary.byteLength, true)
    view.setUint32(at + 4, BIN_CHUNK, true)
    file.set(binary, at + 8)
  }

  return file
}

/** The ordinary case: one picture in the binary chunk, worn by one slot of one material. */
export function glbWearing(slot: string, bytes: Uint8Array, mimeType = 'image/jpeg'): Uint8Array {
  return glbFile(
    {
      materials: [{ name: 'PBR', pbrMetallicRoughness: { [slot]: { index: 0 } } }],
      textures: [{ source: 0 }],
      images: [{ bufferView: 0, mimeType }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.byteLength }],
    },
    bytes,
  )
}

function padded(bytes: Uint8Array, filler: number): Uint8Array {
  const extra = (4 - (bytes.byteLength % 4)) % 4
  if (extra === 0) return bytes

  const grown = new Uint8Array(bytes.byteLength + extra).fill(filler)
  grown.set(bytes)
  return grown
}
