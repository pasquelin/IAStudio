import {
  kindForWorkspace,
  type DocumentDescriptor,
  type DocumentKind,
} from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import i18next from 'i18next'
import { create as createStore } from 'zustand'
import { getBridge } from '@/services/bridge'
import { newId } from '@/helpers/ids'
import { useLayouts } from './layouts'

type DocumentsState = {
  documents: Record<string, DocumentDescriptor>
  /**
   * The document the centre is showing. Tool windows sit outside Dockview and have no other way
   * to know which document they are inspecting — a layer stack has to follow the active tab.
   */
  activeId: string | null
  /** Reads the open project's folder and keeps the documents a layout still shows. */
  refresh: () => Promise<void>
  /** `null` when the workspace has no editable document kind yet. */
  create: (workspace: WorkspaceId) => Promise<DocumentDescriptor | null>
  activate: (id: string | null) => void
  close: (id: string) => void
}

export type DocumentsSlice = Pick<DocumentsState, 'documents' | 'activeId'>

/**
 * The document in front, when it is one of a given kind. A scene panel handed an image
 * document would give `useScenes` a state and a history for a document that has no scene.
 */
export function activeIdOfKind(state: DocumentsSlice, kind: DocumentKind): string | null {
  const id = state.activeId
  return id !== null && state.documents[id]?.kind === kind ? id : null
}

/**
 * The scene in front, as a selector. Shared rather than re-declared per panel: a selector built
 * inside a component body is a new identity on every render, and zustand re-subscribes to it.
 */
export const activeSceneId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'scene')

/** The image in front, as a selector. Same reason as `activeSceneId`, for the layer stack. */
export const activeImageId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'image')

/** The sequence in front, as a selector. Same reason again, for the montage and its inspector. */
export const activeSequenceId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'sequence')

/** The sky in front, as a selector. Same reason again, for the skybox panel. */
export const activeSkyboxId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'skybox')

export function documentsIn(
  state: Pick<DocumentsState, 'documents'>,
  workspace: WorkspaceId,
): DocumentDescriptor[] {
  return Object.values(state.documents).filter(document => document.workspace === workspace)
}

/**
 * The documents some layout still shows, across every workspace.
 *
 * A tab cannot say this for itself: switching workspace unmounts Dockview, which removes every
 * panel of the workspace being left — reading that would drop the documents the user is coming
 * back to. The persisted layouts are the reliable record of what is open.
 */
export function panelIds(layouts: Record<string, { panels?: object } | undefined>): Set<string> {
  const shown = new Set<string>()
  for (const layout of Object.values(layouts)) {
    for (const id of Object.keys(layout?.panels ?? {})) shown.add(id)
  }
  return shown
}

/**
 * The open documents.
 *
 * Not persisted, and it must not be: which documents exist belongs to the project folder, not
 * to the application. Kept in `localStorage`, the tabs of one project reappeared in the next —
 * pointing at files that are not there, or worse, at a file of the same id in another project.
 *
 * So the folder says which documents exist and what they are called; the persisted layout says
 * which of them are open. Loading is `load` plus `pruneDocuments`, in that order.
 */
export const useDocuments = createStore<DocumentsState>()((set, get) => ({
  documents: {},
  activeId: null,

  // Guarded: Dockview announces the active panel again on each workspace switch — usually the
  // same value, and every `set` wakes every subscriber.
  activate: id => {
    if (get().activeId !== id) set({ activeId: id })
  },

  refresh: async () => {
    const mine = ++generation
    let listed: DocumentDescriptor[] = []
    try {
      listed = (await getBridge()?.documents.list()) ?? []
    } catch {
      // No project open, or a folder that went away: an empty centre is the honest answer.
    }

    // A second project opened while the first was still listing: the last answer to arrive is
    // not necessarily the one that was asked for last.
    if (mine !== generation) return

    const shown = panelIds(useLayouts.getState().layouts)
    set({
      // One `set` for both halves: the folder says which documents exist, the layout says which
      // are open, and between two writes every tab would paint and unpaint.
      documents: Object.fromEntries(
        listed.filter(document => shown.has(document.id)).map(document => [document.id, document]),
      ),
      // Nothing is in front until Dockview says so, and the previous project's tab certainly is
      // not.
      activeId: null,
    })
  },

  create: async workspace => {
    const kind = kindForWorkspace(workspace)
    if (!kind) return null

    const document: DocumentDescriptor = {
      id: newId(),
      kind,
      workspace,
      title: i18next.t('documents.untitled', { n: documentsIn(get(), workspace).length + 1 }),
    }

    // Written before it is announced, and empty: the project folder is what says a document
    // exists, so a tab opened and not yet typed in must survive a reload like any other. A
    // write that fails opens no tab rather than one the next launch would silently drop.
    await getBridge()?.documents.write(document.id, kind, {
      title: document.title,
      content: undefined,
    })

    set(state => ({ documents: { ...state.documents, [document.id]: document } }))
    return document
  },

  close: id =>
    set(state => {
      const remaining = { ...state.documents }
      delete remaining[id]
      return { documents: remaining, activeId: state.activeId === id ? null : state.activeId }
    }),
}))

/** Bumped per refresh, so a listing that comes back late cannot install itself. */
let generation = 0
