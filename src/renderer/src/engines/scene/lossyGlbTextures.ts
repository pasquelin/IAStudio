import { glbChunksOf, glbFrom, glbJson } from '@shared/domain/glbContainer'
import { isRecord } from '@shared/guards'
import type { ExportedAssetOverride } from '@shared/domain/gameExport'

export type EmbeddedTextureTransform = (
  id: string,
  bytes: Uint8Array,
) => Promise<ExportedAssetOverride | null>

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
  const additions: Uint8Array[] = []
  let addedBytes = 0

  for (const [imageIndex, image] of images.entries()) {
    if (!isRecord(image) || typeof image.bufferView !== 'number') continue
    const view = views[image.bufferView]
    if (!isRecord(view)) continue
    if (view.buffer !== undefined && view.buffer !== 0) continue
    const offset = typeof view.byteOffset === 'number' ? view.byteOffset : 0
    if (typeof view.byteLength !== 'number') continue
    const source = chunks.bin.slice(offset, offset + view.byteLength)
    const optimized = await transform(`${assetId}:${imageIndex}`, source)
    if (!optimized) continue
    const padding = (4 - ((chunks.bin.byteLength + addedBytes) % 4)) % 4
    if (padding > 0) {
      additions.push(new Uint8Array(padding))
      addedBytes += padding
    }
    Reflect.set(view, 'byteOffset', chunks.bin.byteLength + addedBytes)
    Reflect.set(view, 'byteLength', optimized.bytes.byteLength)
    Reflect.set(image, 'mimeType', optimized.extension === 'jpg' ? 'image/jpeg' : 'image/png')
    additions.push(optimized.bytes)
    addedBytes += optimized.bytes.byteLength
  }
  if (additions.length === 0) return null

  const bin = new Uint8Array(chunks.bin.byteLength + addedBytes)
  bin.set(chunks.bin)
  let at = chunks.bin.byteLength
  for (const addition of additions) {
    bin.set(addition, at)
    at += addition.byteLength
  }
  const buffers = Array.isArray(document.buffers) ? document.buffers : []
  if (isRecord(buffers[0])) Reflect.set(buffers[0], 'byteLength', bin.byteLength)
  return {
    id: assetId,
    bytes: glbFrom({ json: new TextEncoder().encode(JSON.stringify(document)), bin }),
    extension: 'glb',
  }
}
