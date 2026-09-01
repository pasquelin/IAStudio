import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'
import { useDocuments } from '@/stores/documents'

/**
 * The folder a document's media links are relative to — its own, so a project stays movable.
 *
 * Segments and not a path: that is what `mediaLinkOf` and `assetIdForLink` take, under this name.
 */
export function documentFolder(documentId: string): readonly string[] {
  const path = useDocuments.getState().documents[documentId]?.path ?? FOLDER_ROOT
  const folder = parentOf(path) ?? FOLDER_ROOT
  return folder === FOLDER_ROOT ? [] : folder.split('/')
}
