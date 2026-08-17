import {
  DOCUMENTS_FOLDER,
  kindForWorkspace,
  type DocumentDescriptor,
} from '@shared/domain/document'
import { documentFileName } from '@shared/domain/documentName'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { DocumentStore } from './documentStore'
import { useDocuments } from './documents'

/**
 * The whole of what an `install<X>` does: a store put back as it was built, one document in it,
 * and a tab in front of it. Written once because the five differ only by their store and their
 * workspace — and because the sixth document store, `audioEdits`, has no fixture of its own.
 *
 * The document arrives through `replace`, the door production uses to bring one in, rather than
 * through a `setState` of its own shape: a fixture that reaches past the store's own actions is
 * how the marks `resetForTests` clears came to outlive a case in the first place.
 */
export function installIn<S>(
  store: DocumentStore<S>,
  documentId: string,
  state: S,
  workspace: WorkspaceId,
): void {
  store.resetForTests()
  store.use.getState().replace(documentId, state)
  installDocument(documentId, workspace)
}

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
  installDocuments({ [documentId]: workspace }, documentId)
}

/**
 * Several tabs at once, one of them in front — what a gesture that crosses workspaces needs to
 * be tested against, and what a single-document fixture cannot describe.
 */
export function installDocuments(tabs: Record<string, WorkspaceId>, activeId: string): void {
  const documents: Record<string, DocumentDescriptor> = {}
  for (const [documentId, workspace] of Object.entries(tabs)) {
    const kind = kindForWorkspace(workspace)
    if (!kind) throw new Error(`workspace "${workspace}" has no document kind`)
    documents[documentId] = {
      id: documentId,
      kind,
      workspace,
      title: documentId,
      path: `${DOCUMENTS_FOLDER}/${documentFileName(documentId, kind)}`,
    }
  }

  useDocuments.setState({ documents, activeId })
}
