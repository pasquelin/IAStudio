import { kindForWorkspace, type DocumentDescriptor } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import i18next from 'i18next'
import { create as createStore } from 'zustand'
import { persist } from 'zustand/middleware'

type DocumentsState = {
  documents: Record<string, DocumentDescriptor>
  /**
   * The document the centre is showing. Tool windows sit outside Dockview and have no other way
   * to know which document they are inspecting — a layer stack has to follow the active tab.
   */
  activeId: string | null
  /** `null` when the workspace has no editable document kind yet. */
  create: (workspace: WorkspaceId) => DocumentDescriptor | null
  activate: (id: string | null) => void
  close: (id: string) => void
  /** Drops every document not in `ids`. Called once at startup — see `pruneDocuments`. */
  keepOnly: (ids: ReadonlySet<string>) => void
}

export function documentsIn(
  state: Pick<DocumentsState, 'documents'>,
  workspace: WorkspaceId,
): DocumentDescriptor[] {
  return Object.values(state.documents).filter(document => document.workspace === workspace)
}

/**
 * Drops the documents no layout shows any more, once at startup.
 *
 * Closing a tab cannot do this itself: switching workspace unmounts Dockview, which removes
 * every panel of the workspace being left — reacting to that would delete the documents the
 * user is coming back to. The persisted layouts are the reliable record of what is open.
 */
export function pruneDocuments(layouts: Record<string, { panels?: object } | undefined>): void {
  const shown = new Set<string>()
  for (const layout of Object.values(layouts)) {
    for (const id of Object.keys(layout?.panels ?? {})) shown.add(id)
  }
  useDocuments.getState().keepOnly(shown)
}

/**
 * The open documents.
 *
 * Persisted, and it has to be: `stores/layouts.ts` already persists the Dockview layout, so a
 * reload brings the tabs back. Keeping the descriptors in memory only made those tabs come
 * back empty — the tab was there, the page was not.
 *
 * What is persisted is the descriptor, not the content: the project folder still holds no
 * file. Reopening the app therefore restores a tab and a blank document, never stale pixels.
 */
export const useDocuments = createStore<DocumentsState>()(
  persist(
    (set, get) => ({
      documents: {},
      activeId: null,

      // Guarded: `persist` writes to localStorage on every `set`, and Dockview announces the
      // active panel again on each workspace switch — usually the same value.
      activate: id => {
        if (get().activeId !== id) set({ activeId: id })
      },

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
          return { documents: remaining, activeId: state.activeId === id ? null : state.activeId }
        }),

      keepOnly: ids =>
        set(state => ({
          documents: Object.fromEntries(
            Object.entries(state.documents).filter(([id]) => ids.has(id)),
          ),
          // Same rule as `close`: a document that is gone cannot be the one in front.
          activeId: state.activeId && ids.has(state.activeId) ? state.activeId : null,
        })),
    }),
    {
      name: 'scenario-studio:documents',
      version: 1,
      // A version bump must not silently drop what the user has open. A descriptor whose `kind`
      // no longer exists is handled at render time.
      migrate: persisted => (typeof persisted === 'object' ? persisted : undefined),
      // Which tab is in front is session state, like `focusedZone`: Dockview announces it on
      // mount, and restoring a stale id would point the layer stack at a tab nobody opened.
      partialize: state => ({ documents: state.documents }),
    },
  ),
)
