import type { TaskWatch } from '@shared/domain/taskProgress'
import type { FolderExportRequest, SkyboxExportCommand } from '@shared/ipc'
import { loadTexture } from '@/engines/scene/textureCache'
import { assetVersionOf } from '@/stores/assets'
import { documentExportName, useDocuments } from '@/stores/documents'
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
  { size, target = 'sky.faces' }: SkyboxExportCommand,
  watch?: TaskWatch,
): Promise<FolderExportRequest> {
  // Read once, before any `await`. Read twice — the picture here and the grading after the
  // `import()` — and a slider moved while the chunk downloads would export one sky's pixels
  // under another sky's settings, with nothing in the six files to say so.
  const sky = skyboxOf(useSkyboxes.getState(), documentId)
  if (!sky.source) throw new Error('this sky has no source to export')

  const name = documentExportName(useDocuments.getState(), documentId, 'skybox')

  const { createSkyboxExportPort } = await import('@/engines/skybox/exportPort')
  const files = await createSkyboxExportPort({ loadTexture, assetVersion: assetVersionOf })(
    { assetId: sky.source.assetId, adjustments: sky.adjustments, name, size, target },
    watch,
  )

  // The folder is the six faces' own — a panorama is ONE file, and burying it under a directory
  // named after it would make the person open a folder to find a single picture.
  return { folder: target === 'sky.faces' ? name : '', target, files }
}
