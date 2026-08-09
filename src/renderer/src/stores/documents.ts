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
  /**
   * Everything the project folder holds, open or not — what the Explorer lists.
   *
   * Beside `documents` rather than derived from it: `documents` is what the window is showing,
   * and a document closed and gone from every layout would vanish from the folder listing too,
   * which is exactly the document one needs the Explorer to find.
   */
  stored: DocumentDescriptor[]
  /**
   * Re-reads the folder into `stored`, and nothing else.
   *
   * Separate from `refresh` on purpose: a panel that wants a listing must not also settle which
   * tabs are open. `create` posts a descriptor without writing a file — deliberately, so a tab
   * opened and never typed in leaves nothing behind — and a reconciliation triggered by opening
   * the Explorer would evict exactly that document while its tab is still on screen.
   *
   * `after: 'own-write'` for a caller that has just written or deleted a file: the listing this
   * shares otherwise may have started BEFORE that write, and would answer without it.
   */
  relist: (after?: 'own-write') => Promise<void>
  /**
   * Reads the open project's folder and settles both halves: what exists, and which of those a
   * layout still shows. For a change of project — where dropping the documents of the previous
   * one is the whole point.
   *
   * Answers whether the folder was read at all. An empty centre is the honest answer to a
   * folder that went away, but it is NOT an answer about which tabs deserve to survive: only a
   * listing that came back says a document is nowhere.
   */
  refresh: () => Promise<boolean>
  /** `null` when the workspace has no editable document kind yet. */
  create: (workspace: WorkspaceId) => Promise<DocumentDescriptor | null>
  activate: (id: string | null) => void
  /**
   * Takes in a document the folder holds but no tab shows yet — what the Explorer hands over
   * when one of its rows is opened. Idempotent, and it never overwrites: the open descriptor is
   * the one the tab has been renaming, and the listing it came from is a snapshot.
   */
  adopt: (document: DocumentDescriptor) => void
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

/** What kind of document is in front, or `null` when none is. */
export function activeKind(state: DocumentsSlice): DocumentKind | null {
  return (state.activeId !== null && state.documents[state.activeId]?.kind) || null
}

/**
 * A document of a kind, preferring the one in front.
 *
 * What tells "a tab of this kind is open somewhere" from `activeIdOfKind`'s "the tab in front is
 * of this kind" — the difference between a gesture that crosses workspaces and one that only
 * works on the tab already on screen.
 */
export function documentOfKind(
  state: DocumentsSlice,
  kind: DocumentKind,
): DocumentDescriptor | null {
  const front = state.activeId !== null ? state.documents[state.activeId] : undefined
  if (front?.kind === kind) return front

  return Object.values(state.documents).find(document => document.kind === kind) ?? null
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

/** The texture in front, as a selector. Same reason again, for the material inspector. */
export const activeTextureId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'texture')

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
 * which of them are open — `refresh` reads both and keeps the intersection.
 */
export const useDocuments = createStore<DocumentsState>()((set, get) => ({
  documents: {},
  stored: [],
  activeId: null,

  // Guarded: Dockview announces the active panel again on each workspace switch — usually the
  // same value, and every `set` wakes every subscriber.
  activate: id => {
    if (get().activeId !== id) set({ activeId: id })
  },

  relist: async after => {
    // Callers that only want the folder share the listing already in flight rather than opening
    // a second one: three surfaces ask on the same paint — the home's shelf, its tree, and the
    // project that just opened — and each answer costs a round trip and a folder walk.
    if (listing && after !== 'own-write') {
      await listing
      return
    }

    const mine = ++generations.relist
    listing = listed()

    try {
      const found = await listing
      // A second project opened while the first was still listing: the last answer to arrive is
      // not necessarily the one that was asked for last.
      if (mine === generations.relist) set({ stored: sorted(found ?? []) })
    } finally {
      listing = null
    }
  },

  refresh: async () => {
    const mine = ++generations.refresh
    const found = await listed()
    if (mine !== generations.refresh) return false

    const listing = found ?? []
    const shown = panelIds(useLayouts.getState().layouts)
    // One `set` for both halves: the folder says which documents exist, the layout says which
    // are open, and between two writes every tab would paint and unpaint.
    const documents = Object.fromEntries(
      listing.filter(document => shown.has(document.id)).map(document => [document.id, document]),
    )

    set(state => ({
      documents,
      stored: sorted(listing),
      // Kept when the tab survived the load: Dockview announces the active panel on mount, and
      // that happens before this listing comes back — clearing it here would leave every tool
      // window looking at nothing while a document is plainly open.
      activeId: state.activeId && documents[state.activeId] ? state.activeId : null,
    }))

    return found !== null
  },

  create: async workspace => {
    const kind = kindForWorkspace(workspace)
    if (!kind) return null

    // Numbered against the folder as much as against the open tabs: a document saved and then
    // closed still holds its name, and counting only what is open hands that name out twice.
    const stored = (await listed()) ?? []
    const taken = new Set([
      ...stored.filter(document => document.workspace === workspace).map(document => document.id),
      ...documentsIn(get(), workspace).map(document => document.id),
    ])

    const document: DocumentDescriptor = {
      id: newId(),
      kind,
      workspace,
      title: i18next.t('documents.untitled', { n: taken.size + 1 }),
    }

    // Nothing is written yet, and nothing should be: a document appears in the folder when it
    // holds something. A file per tab opened and never typed in would litter the project with
    // empty documents that only a hand could remove.
    set(state => ({ documents: { ...state.documents, [document.id]: document } }))
    return document
  },

  adopt: document =>
    set(state =>
      state.documents[document.id]
        ? state
        : { documents: { ...state.documents, [document.id]: document } },
    ),

  close: id =>
    set(state => {
      const remaining = { ...state.documents }
      delete remaining[id]
      return { documents: remaining, activeId: state.activeId === id ? null : state.activeId }
    }),
}))

/**
 * Bumped per listing, so one that comes back late cannot install itself — and one PER QUESTION.
 *
 * A shared counter looked harmless and was not: the Explorer relists from a mount effect while
 * `followProject` is still awaiting its own read, and the relist would then make the refresh
 * abandon — leaving every open tab without its descriptor, which is the very reconciliation
 * `refresh` exists for.
 */
const generations = { relist: 0, refresh: 0 }

/** The listing `relist` has in flight, shared by whoever asks while it is still travelling. */
let listing: Promise<DocumentDescriptor[] | null> | null = null

/**
 * Sorted by title rather than by whatever order the folder was read in: a listing that
 * reshuffles between two reads is a list nobody can point at.
 */
function sorted(found: readonly DocumentDescriptor[]): DocumentDescriptor[] {
  return [...found].sort((left, right) => left.title.localeCompare(right.title))
}

/**
 * What the project folder holds, an empty list when no project is open, and `null` when the
 * read itself failed — a folder that went away while it was open.
 *
 * The failure is told apart from the empty answer rather than levelled to it: both leave an
 * empty centre, which is honest, but only the empty answer means a document is not there.
 * Neither is worth a throw nobody is placed to catch.
 */
async function listed(): Promise<DocumentDescriptor[] | null> {
  try {
    return (await getBridge()?.documents.list()) ?? []
  } catch {
    return null
  }
}
