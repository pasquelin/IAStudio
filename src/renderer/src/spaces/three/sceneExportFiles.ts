import { safeFileName } from '@shared/domain/fileName'
import { EXPORT_EXTENSIONS, type ExportFormat } from '@shared/domain/scene'
import type { FolderExportRequest } from '@shared/ipc'
import { useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/sceneEngines'

/**
 * A scene, encoded to one file — the half of an export that has nothing to do with where it lands.
 *
 * The engine is fetched from `sceneEngineOf` rather than passed in, which is what lets an outside
 * client ask for this at all: only the viewport holds the live renderer, and a tab whose viewport
 * is not mounted has none.
 *
 * A folder for a single file, like every other door onto this writer. It costs one level of
 * nesting and buys one channel instead of two, the second of which would exist only to say
 * "actually just one file".
 */
export async function sceneExportFiles(
  documentId: string,
  format: ExportFormat,
  scope: 'scene' | 'selection',
): Promise<FolderExportRequest> {
  const engine = sceneEngineOf(documentId)
  if (!engine) throw new Error('this scene has no viewport mounted to export from')

  const name = safeFileName(useDocuments.getState().documents[documentId]?.title ?? 'scene')
  return {
    folder: name,
    files: [
      { name, extension: EXPORT_EXTENSIONS[format], bytes: await engine.exportTo(format, scope) },
    ],
  }
}
