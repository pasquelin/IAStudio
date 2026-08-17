import { safeFileName } from '@shared/domain/fileName'
import type { FolderExportRequest } from '@shared/ipc'
import { loadTexture } from '@/engines/scene/textureCache'
import { assetVersionOf } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'

/**
 * A sky, rendered to its six faces — the half of an export that has nothing to do with where it
 * lands.
 *
 * Split out because there are now two destinations for the same bytes: the folder a person picks
 * from the native menu, and a folder an outside client names inside the project. What differs is
 * one call; what must not differ is any of this.
 */
export async function skyboxExportFiles(
  documentId: string,
  size: number,
): Promise<FolderExportRequest> {
  // Read once, before any `await`. Read twice — the picture here and the grading after the
  // `import()` — and a slider moved while the chunk downloads would export one sky's pixels
  // under another sky's settings, with nothing in the six files to say so.
  const sky = skyboxOf(useSkyboxes.getState(), documentId)
  if (!sky.source) throw new Error('this sky has no source to export')

  // Cleaned before it is either a folder or a file name: a document is titled by hand.
  const name = safeFileName(useDocuments.getState().documents[documentId]?.title ?? 'skybox')

  const { createSkyboxExportPort } = await import('@/engines/skybox/exportPort')
  const files = await createSkyboxExportPort({ loadTexture, assetVersion: assetVersionOf })({
    assetId: sky.source.assetId,
    adjustments: sky.adjustments,
    name,
    size,
  })

  return { folder: name, files }
}
