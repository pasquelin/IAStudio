import { kindForWorkspace, type DocumentDescriptor } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import i18next from 'i18next'
import { create as createStore } from 'zustand'

type DocumentsState = {
  documents: Record<string, DocumentDescriptor>
  /** `null` when the workspace has no editable document kind yet. */
  create: (workspace: WorkspaceId) => DocumentDescriptor | null
  close: (id: string) => void
}

export function documentsIn(
  state: Pick<DocumentsState, 'documents'>,
  workspace: WorkspaceId,
): DocumentDescriptor[] {
  return Object.values(state.documents).filter(document => document.workspace === workspace)
}

/**
 * Open documents, in memory only: writing them to the project folder needs a file format, an
 * IPC channel and a watcher, which is a lot of its own. A restored Dockview tab whose document
 * is gone is handled where it shows — see `app/documents.tsx`.
 */
export const useDocuments = createStore<DocumentsState>()((set, get) => ({
  documents: {},

  create: workspace => {
    const kind = kindForWorkspace(workspace)
    if (!kind) return null

    const document: DocumentDescriptor = {
      id: crypto.randomUUID(),
      kind,
      workspace,
      title: i18next.t('documents.untitled', { n: documentsIn(get(), workspace).length + 1 }),
    }

    set(state => ({ documents: { ...state.documents, [document.id]: document } }))
    return document
  },

  close: id =>
    set(state => {
      const remaining = { ...state.documents }
      delete remaining[id]
      return { documents: remaining }
    }),
}))
