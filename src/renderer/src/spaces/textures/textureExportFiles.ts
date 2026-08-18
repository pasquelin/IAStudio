import type { TextureExportTarget } from '@shared/domain/textureExport'
import type { FolderExportRequest } from '@shared/ipc'
import { loadTexture } from '@/engines/scene/textureCache'
import { exportChannelsOf } from '@/engines/texture/export/channels'
import { documentExportName, useDocuments } from '@/stores/documents'
import { textureOf, useTextures } from '@/stores/textures'

/**
 * A material, baked to the files one target asks for — the half of an export that has nothing to
 * do with where it lands.
 *
 * Split out for the reason its skybox twin was: two destinations, one rendering. The port is
 * reached through `import()` for the chunk after the first screen — statically imported,
 * `GLTFExporter` would be downloaded by anyone who opens a texture tab.
 */
export async function textureExportFiles(
  documentId: string,
  target: TextureExportTarget,
): Promise<FolderExportRequest> {
  const texture = textureOf(useTextures.getState(), documentId)
  const name = documentExportName(useDocuments.getState(), documentId, 'texture')

  const { createTextureExportPort } = await import('@/engines/texture/export/exportPort')
  const files = await createTextureExportPort({ loadTexture })({
    target,
    channels: exportChannelsOf(texture),
    name,
    material: texture.material,
    shape: texture.preview.shape,
  })

  // A texture with no channels resolves to no file, and a destination asked for nothing is a
  // question nobody can answer — whoever asked it.
  if (files.length === 0) throw new Error('this texture has no channel to export')

  return { folder: name, files }
}
