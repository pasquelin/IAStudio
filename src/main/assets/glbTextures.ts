import { isRecord } from '@shared/guards'
import { textureSlotsOf } from '@shared/domain/gltf'
import type { PbrChannel } from '@shared/domain/texture'

/** `glTF` in ASCII, little-endian — the four bytes every `.glb` opens with. */
const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942
const HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8

/**
 * How a glTF texture slot maps onto the studio's own channels.
 *
 * Only the slots that mean exactly one channel are here. `metallicRoughnessTexture` is
 * deliberately absent: glTF packs roughness in green and metalness in blue of ONE picture, and
 * the studio stores those as two channels — calling it either would label the pixels wrongly.
 * It still comes out, as a texture with no channel claimed, which is the honest answer until
 * something splits it.
 *
 * Extension slots are matched by their own names, so `KHR_materials_clearcoat` contributes
 * nothing here and its picture is extracted unlabelled rather than mislabelled.
 */
const CHANNEL_OF_SLOT: Record<string, PbrChannel> = {
  baseColorTexture: 'baseColor',
  normalTexture: 'normal',
  occlusionTexture: 'ao',
  emissiveTexture: 'emissive',
}

export type EmbeddedTexture = {
  /** The picture exactly as the file holds it — never re-encoded, so nothing is lost. */
  bytes: Uint8Array
  /** `image/jpeg`, `image/png`… what the file declares, and what names the extension. */
  mimeType: string
  /** Which channel these pixels ARE, when the slot that used them means exactly one. */
  channel?: PbrChannel
  /** The glTF slot it was found in — `baseColorTexture`. Names the asset the studio creates. */
  slot: string
}

/**
 * Every picture a `.glb` carries, with the role its materials give it.
 *
 * Read here rather than in the window, and copied rather than decoded: the bytes are already a
 * JPEG or a PNG, so extracting a texture costs a memcpy instead of a GPU round trip and a
 * re-encode that would soften what the model was painted with.
 *
 * A file this cannot parse yields nothing rather than throwing: it is asked for from a menu row,
 * and a model whose bytes are not a `.glb` is a normal thing to click on.
 */
export function embeddedTextures(file: Uint8Array): EmbeddedTexture[] {
  const chunks = chunksOf(file)
  if (!chunks) return []

  const gltf: unknown = parseJson(chunks.json)
  if (!isRecord(gltf)) return []

  const images = Array.isArray(gltf.images) ? gltf.images : []
  const textures = Array.isArray(gltf.textures) ? gltf.textures : []
  const bufferViews = Array.isArray(gltf.bufferViews) ? gltf.bufferViews : []
  const materials = Array.isArray(gltf.materials) ? gltf.materials : []

  // Walked from the MATERIALS rather than over `images`: a picture's role is the slot that uses
  // it, and a file may declare images no material ever wears. Every slot wearing one picture is
  // collected before any of them decides what it IS — see `channelWornBy`.
  const slotsPerImage = new Map<number, string[]>()
  for (const material of materials) {
    for (const { slot, index } of textureSlotsOf(material)) {
      const source = sourceOf(textures[index])
      if (source === undefined) continue

      const worn = slotsPerImage.get(source)
      if (worn) worn.push(slot)
      else slotsPerImage.set(source, [slot])
    }
  }

  const found: EmbeddedTexture[] = []
  for (const [source, slots] of slotsPerImage) {
    const picture = pictureOf(images[source], bufferViews, chunks.bin)
    if (!picture) continue

    const channel = channelWornBy(slots)
    found.push({ ...picture, slot: slots[0] ?? '', ...(channel ? { channel } : {}) })
  }

  return found
}

/**
 * What one picture IS, given every slot that wears it — and nothing when they disagree.
 *
 * An ORM export is the ordinary case: one file read as occlusion by one slot and as
 * metal-roughness by another. Labelling it from whichever slot the JSON happens to spell first
 * would file a packed map under `ao`, and "which occlusion maps does this project hold" would
 * answer with a picture that is mostly not one.
 */
function channelWornBy(slots: readonly string[]): PbrChannel | undefined {
  const claimed = new Set(slots.map(slot => CHANNEL_OF_SLOT[slot]))
  const only = [...claimed]

  return claimed.size === 1 ? only[0] : undefined
}

/** The two chunks a `.glb` is made of, or null when the bytes are not one. */
function chunksOf(file: Uint8Array): { json: Uint8Array; bin: Uint8Array } | null {
  if (file.byteLength < HEADER_BYTES) return null

  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) return null

  let json: Uint8Array | null = null
  let bin: Uint8Array | null = null

  let offset = HEADER_BYTES
  while (offset + CHUNK_HEADER_BYTES <= file.byteLength) {
    const length = view.getUint32(offset, true)
    const kind = view.getUint32(offset + 4, true)
    const start = offset + CHUNK_HEADER_BYTES
    // A length that overruns the file is a truncated download, not a chunk: stop rather than
    // hand a reader a window onto bytes that are not there.
    if (start + length > file.byteLength) break

    const body = file.subarray(start, start + length)
    if (kind === JSON_CHUNK) json ??= body
    if (kind === BIN_CHUNK) bin ??= body

    offset = start + length
  }

  return json ? { json, bin: bin ?? new Uint8Array() } : null
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/**
 * Which image a texture reads from — under `source`, or under the extension that replaced it.
 *
 * `KHR_texture_basisu` and `EXT_texture_webp` move `source` inside themselves, and a compressed
 * `.glb` is not an edge case here: `createGltfSource` wires a KTX2 decoder precisely because the
 * studio loads such files. Reading only the top level answered "carries no picture of its own"
 * for a model the viewport was visibly painting.
 */
function sourceOf(texture: unknown): number | undefined {
  if (!isRecord(texture)) return undefined
  if (typeof texture.source === 'number') return texture.source

  const extensions = isRecord(texture.extensions) ? Object.values(texture.extensions) : []
  for (const extension of extensions) {
    if (isRecord(extension) && typeof extension.source === 'number') return extension.source
  }

  return undefined
}

/**
 * One image, bytes and declared type together: a slice of the binary chunk, or what a `data:`
 * URI carries. `image/png` when the file says nothing, which glTF allows.
 *
 * An image pointing at a FILE beside the `.glb` yields nothing. The studio's models come down
 * as single self-contained files, and reading a sibling path out of a document would be reading
 * a path the catalogue never vouched for.
 */
function pictureOf(
  image: unknown,
  bufferViews: unknown[],
  bin: Uint8Array,
): { bytes: Uint8Array; mimeType: string } | null {
  if (!isRecord(image)) return null

  const declared = image.mimeType

  if (typeof image.uri === 'string') {
    const bytes = dataUriBytes(image.uri)
    if (!bytes) return null

    // The URI's own type first: `mimeType` is optional for a `uri` image precisely because the
    // URI carries it, and defaulting to PNG there wrote JPEG bytes into a file named `.png` —
    // served as a PNG afterwards, by a name the bytes do not answer to.
    const carried = /^data:([^;,]+)/.exec(image.uri)?.[1]
    return { bytes, mimeType: typeof declared === 'string' ? declared : (carried ?? 'image/png') }
  }

  const mimeType = typeof declared === 'string' ? declared : 'image/png'
  if (typeof image.bufferView !== 'number') return null

  const view = bufferViews[image.bufferView]
  if (!isRecord(view)) return null

  const offset = typeof view.byteOffset === 'number' ? view.byteOffset : 0
  const length = typeof view.byteLength === 'number' ? view.byteLength : 0
  if (length <= 0 || offset + length > bin.byteLength) return null

  return { bytes: bin.subarray(offset, offset + length), mimeType }
}

function dataUriBytes(uri: string): Uint8Array | null {
  const comma = uri.indexOf(',')
  if (!uri.startsWith('data:') || comma === -1 || !uri.slice(0, comma).includes(';base64')) {
    return null
  }

  try {
    return Uint8Array.from(Buffer.from(uri.slice(comma + 1), 'base64'))
  } catch {
    return null
  }
}
