import { kindForWorkspace } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { useDocuments } from './documents'

/**
 * Puts one document of a workspace in front of a panel under test. Every panel resolves its
 * document through `activeIdOfKind`, so an id with no descriptor behind it reads as "nothing
 * open" — which is what made the per-space fixtures declare a descriptor each, and write the
 * kind/workspace pair by hand three times over.
 *
 * The kind comes from `kindForWorkspace` rather than from the caller: it is the same table the
 * application builds documents with, so a fixture cannot describe a pairing that cannot exist.
 */
export function installDocument(documentId: string, workspace: WorkspaceId): void {
  const kind = kindForWorkspace(workspace)
  if (!kind) throw new Error(`workspace "${workspace}" has no document kind`)

  useDocuments.setState({
    documents: { [documentId]: { id: documentId, kind, workspace, title: documentId } },
    activeId: documentId,
  })
}
