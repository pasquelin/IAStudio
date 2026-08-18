import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'
import { useDocuments } from '@/stores/documents'

/**
 * The folder a document's media links are relative to — its own, so a project stays movable.
 *
 * Segments and not a path, which is what `mediaLinkOf` and `assetIdForLink` both take under that
 * very name. Written once here rather than in each editor that saves links: three of them held
 * the same five lines, and a document whose folder was read differently would write links no
 * other reader could resolve.
 */
export function documentFolder(documentId: string): readonly string[] {
  const path = useDocuments.getState().documents[documentId]?.path ?? FOLDER_ROOT
  const folder = parentOf(path) ?? FOLDER_ROOT
  return folder === FOLDER_ROOT ? [] : folder.split('/')
}
