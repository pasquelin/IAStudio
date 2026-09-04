import { glbChunksOf, glbFrom, glbJson } from '@shared/domain/glbContainer'
import { isRecord } from '@shared/guards'
import type { ExportedAssetOverride } from '@shared/domain/gameExport'

export type EmbeddedTextureTransform = (
  id: string,
  bytes: Uint8Array,
) => Promise<ExportedAssetOverride | null>

type EmbeddedImage = {
  image: Record<string, unknown>
  view: Record<string, unknown>
  source: Uint8Array
}
type BinaryAdditions = { parts: Uint8Array[]; byteLength: number }

export async function optimizedGlbTextures(
  assetId: string,
  file: Uint8Array,
  transform: EmbeddedTextureTransform,
): Promise<ExportedAssetOverride | null> {
  const chunks = glbChunksOf(file)
  if (!chunks) return null
  const document = glbJson(chunks.json)
  if (!isRecord(document)) return null
  const images = Array.isArray(document.images) ? document.images : []
  const views = Array.isArray(document.bufferViews) ? document.bufferViews : []
  const additions = await optimizedImageAdditions(assetId, images, views, chunks.bin, transform)
  if (additions.parts.length === 0) return null
  const bin = joinedBinary(chunks.bin, additions)
  const buffers = Array.isArray(document.buffers) ? document.buffers : []
  if (isRecord(buffers[0])) Reflect.set(buffers[0], 'byteLength', bin.byteLength)
  return {
    id: assetId,
    bytes: glbFrom({ json: new TextEncoder().encode(JSON.stringify(document)), bin }),
    extension: 'glb',
  }
}

async function optimizedImageAdditions(
  assetId: string,
  images: readonly unknown[],
  views: readonly unknown[],
  binary: Uint8Array,
  transform: EmbeddedTextureTransform,
): Promise<BinaryAdditions> {
  const additions: BinaryAdditions = { parts: [], byteLength: 0 }
  for (const [imageIndex, image] of images.entries()) {
    const embedded = embeddedImageOf(image, views, binary)
    if (!embedded) continue
    const parts = await transformedImageParts(
      assetId,
      imageIndex,
      embedded,
      binary.byteLength + additions.byteLength,
      transform,
    )
    additions.parts.push(...parts)
    additions.byteLength += parts.reduce((total, part) => total + part.byteLength, 0)
  }
  return additions
}

function joinedBinary(binary: Uint8Array, additions: BinaryAdditions): Uint8Array {
  const joined = new Uint8Array(binary.byteLength + additions.byteLength)
  joined.set(binary)
  let offset = binary.byteLength
  for (const addition of additions.parts) {
    joined.set(addition, offset)
    offset += addition.byteLength
  }
  return joined
}

function embeddedImageOf(
  image: unknown,
  views: readonly unknown[],
  binary: Uint8Array,
): EmbeddedImage | null {
  if (!isRecord(image) || typeof image.bufferView !== 'number') return null
  const view = views[image.bufferView]
  if (!isRecord(view) || (view.buffer !== undefined && view.buffer !== 0)) return null
  if (typeof view.byteLength !== 'number') return null
  const offset = typeof view.byteOffset === 'number' ? view.byteOffset : 0
  return { image, view, source: binary.slice(offset, offset + view.byteLength) }
}

async function transformedImageParts(
  assetId: string,
  imageIndex: number,
  embedded: EmbeddedImage,
  targetOffset: number,
  transform: EmbeddedTextureTransform,
): Promise<readonly Uint8Array[]> {
  const optimized = await transform(`${assetId}:${imageIndex}`, embedded.source)
  if (!optimized) return []
  const padding = (4 - (targetOffset % 4)) % 4
  Reflect.set(embedded.view, 'byteOffset', targetOffset + padding)
  Reflect.set(embedded.view, 'byteLength', optimized.bytes.byteLength)
  Reflect.set(
    embedded.image,
    'mimeType',
    optimized.extension === 'jpg' ? 'image/jpeg' : 'image/png',
  )
  return padding > 0 ? [new Uint8Array(padding), optimized.bytes] : [optimized.bytes]
}
