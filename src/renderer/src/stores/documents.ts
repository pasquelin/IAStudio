import {
  DOCUMENTS_FOLDER,
  kindForWorkspace,
  type DocumentDescriptor,
  type DocumentKind,
} from '@shared/domain/document'
import {
  checkDocumentName,
  documentFileName,
  documentPathFor,
  DOCUMENT_NAME_FAILURES,
  type DocumentNameFailure,
  type NamedDocument,
} from '@shared/domain/documentName'
import { foldForFileName, nameFailureOf, safeFileName } from '@shared/domain/fileName'
import { nameOf, parentOf } from '@shared/domain/folder'
import { refFromString } from '@shared/domain/ref'
import type { WorkspaceId } from '@shared/domain/workspace'
import { resolveLanguage } from '@shared/i18n'
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
   * The last document each section had in front. The tab strip holds every section at once, so
   * choosing a section in the rail has to say WHICH of its tabs comes forward — and the one
   * being worked in is the only answer a hand can predict.
   *
   * Session state: it is a trail through the tabs, and a trail through tabs that are no longer
   * open is worth nothing at the next launch.
   */
  recent: Partial<Record<WorkspaceId, string>>
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
  /**
   * `null` when the workspace has no editable document kind yet.
   *
   * `of` carries the name the document is to be given, and where it came from. `sourceAssetId`
   * travels with it when opening an asset — a tab named after an asset it is not linked to would
   * be a title that lies — and stays out when the name was TYPED, which is what the dialog the
   * plus button raises hands over. Without `of` the document is numbered, for a caller with
   * nobody to ask.
   *
   * `folder` is where its author filed it — `documentFolderOf` for a caller who did not ask.
   */
  create: (
    workspace: WorkspaceId,
    of?: { title: string; sourceAssetId?: string; folder?: string },
  ) => Promise<DocumentDescriptor | null>
  activate: (id: string | null) => void
  /**
   * Takes in a document the folder holds but no tab shows yet — what the Explorer hands over
   * when one of its rows is opened. Idempotent, and it never overwrites: the open descriptor is
   * the one the tab has been renaming, and the listing it came from is a snapshot.
   */
  adopt: (document: DocumentDescriptor) => void
  /**
   * Calls a document something else — on disk and on screen at once, which is the whole point:
   * the file is named after the document, so there is only ever one name to change.
   *
   * The id does not move, so an OPEN document renames without its tab noticing.
   *
   * Answers with the refusal, or `null` when it went through. The field has closed by the time
   * this resolves — `InlineRename` commits on blur as much as on Enter — so the answer is for
   * the caller to JOURNAL, not to draw: `reportFailure('document.rename', …)`, which is what
   * puts a refused name in the activity list instead of nowhere.
   */
  rename: (id: string, title: string) => Promise<DocumentNameFailure | null>
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
 * The document a project path names, open in a tab or merely sitting in the folder.
 *
 * `stored` first: it is the folder, and a document listed there but closed is exactly the case
 * an open-by-path has to find. Both halves, for the same reason `documentForAsset` reads both.
 */
export function documentAtPath(
  state: Pick<DocumentsState, 'documents' | 'stored'>,
  path: string,
): DocumentDescriptor | null {
  return (
    state.stored.find(one => one.path === path) ??
    Object.values(state.documents).find(one => one.path === path) ??
    null
  )
}

/** The document an id names. `documents` first, unlike `documentAtPath`: the tab holds the edits. */
export function documentById(
  state: Pick<DocumentsState, 'documents' | 'stored'>,
  id: string,
): DocumentDescriptor | null {
  return state.documents[id] ?? state.stored.find(one => one.id === id) ?? null
}

/**
 * Every document of one kind this project holds — the folder and the tabs, keyed by id so a
 * document open in a tab is not listed twice.
 */
export function documentsOfKind(
  state: Pick<DocumentsState, 'documents' | 'stored'>,
  kind: DocumentKind,
): readonly DocumentDescriptor[] {
  return [
    ...new Map(
      [...state.stored, ...Object.values(state.documents)]
        .filter(one => one.kind === kind)
        .map(one => [one.id, one]),
    ).values(),
  ]
}

/**
 * The document of one kind carrying that title, or `null` — a title is what a spoken request has.
 *
 * Through `documentsOfKind`, so an OPEN tab answers for a document the folder still lists under
 * its former title.
 */
export function documentNamedOfKind(
  state: Pick<DocumentsState, 'documents' | 'stored'>,
  kind: DocumentKind,
  title: string,
): string | null {
  return documentsOfKind(state, kind).find(one => one.title === title)?.id ?? null
}

/**
 * Which scene document a spoken name stands for — a `scene:`/`document:` reference, a title, or
 * an id. Falls back to the word itself, which a reader then answers `null` for.
 *
 * Shared because two doors take the same word: a prefab a model names, and a scene a running
 * game loads. Written twice, the two drifted the day one of them learned to read a reference.
 */
export function sceneDocumentNamed(named: string): string {
  const ref = refFromString(named)
  if (ref?.kind === 'prefab' || ref?.kind === 'document') return ref.id

  return documentNamedOfKind(useDocuments.getState(), 'scene', named) ?? named
}

/**
 * The document already editing an asset, open or merely on disk, or `null` when none is.
 *
 * What keeps a double-click idempotent: opening the same asset twice must come back to its tab
 * rather than open a second one onto the same file — two tabs of one document are two histories
 * of it, and the second save writes over the first.
 *
 * `stored` as well as `documents`, and that is the half that matters most: a document saved for
 * an asset and then CLOSED lives only in the folder listing, and reading the open tabs alone
 * would make the gesture build a second document beside the work it was meant to reopen.
 */
export function documentForAsset(
  state: Pick<DocumentsState, 'documents' | 'stored'>,
  assetId: string,
  /**
   * Narrows to documents of one kind. One asset can legitimately be edited by two of them — a
   * texture is a channel in the Materials space and pixels in the Images one — and a gesture
   * asking for the second must not be handed the first.
   */
  kind?: DocumentKind,
): DocumentDescriptor | null {
  const isIt = (document: DocumentDescriptor): boolean =>
    document.sourceAssetId === assetId && (kind === undefined || document.kind === kind)
  return Object.values(state.documents).find(isIt) ?? state.stored.find(isIt) ?? null
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

/**
 * The take in front, as a selector. Same reason again — and it names the SOUND MONTAGE the
 * timeline shows for it, not the waveform in the centre: an audio document carries both.
 */
export const activeAudioId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'audio')

/**
 * The montage in front, whichever workspace shows it — a sequence in Video, a take's sound half
 * in Audio. Both hold a `SequenceState` in the same store, and a surface that reads only
 * `activeSequenceId` is blind to half of them: the inspector showed nothing at all for a clip
 * picked in the Audio workspace, so gain, speed and fades were editable from nowhere.
 */
export const activeMontageId = (state: DocumentsSlice): string | null =>
  activeSequenceId(state) ?? activeAudioId(state)

/** The sky in front, as a selector. Same reason again, for the skybox panel. */
export const activeSkyboxId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'skybox')

/** The material in front, as a selector. Same reason again, for the material inspector. */
export const activeMaterialId = (state: DocumentsSlice): string | null =>
  activeIdOfKind(state, 'material')

/**
 * Whether this project holds the document an id names — open in a tab or sitting in the folder.
 *
 * Both halves, because a montage read back may name a scene nobody has opened yet: the listing
 * is the project's answer, the tabs are only what is in front of it right now.
 */
export function documentIsKnown(
  state: Pick<DocumentsState, 'documents' | 'stored'>,
  documentId: string,
): boolean {
  return documentById(state, documentId) !== null
}

export function documentsIn(
  state: Pick<DocumentsState, 'documents'>,
  workspace: WorkspaceId,
): DocumentDescriptor[] {
  return Object.values(state.documents).filter(document => document.workspace === workspace)
}

/**
 * Which tab choosing a section brings forward, or `null` when that section has none open.
 *
 * The remembered one when it is still open, and any of the section's tabs otherwise: `recent`
 * is never cleaned when a tab closes, deliberately — a trail that has to be swept on every
 * close is a second bookkeeping to get wrong, and a stale id is answered here in one read.
 */
export function frontDocumentIn(
  state: Pick<DocumentsState, 'documents' | 'recent'>,
  workspace: WorkspaceId,
): string | null {
  const remembered = state.recent[workspace]
  if (remembered !== undefined && state.documents[remembered]) return remembered

  return documentsIn(state, workspace)[0]?.id ?? null
}

/**
 * The documents the layout still shows.
 *
 * Read off the persisted arrangement rather than off Dockview: the centre is unmounted whenever
 * the home covers it, and asking a torn-down api which panels it holds answers none — which
 * would drop every document the user is about to come back to.
 */
export function panelIds(layout: { panels?: object } | null): Set<string> {
  return new Set(Object.keys(layout?.panels ?? {}))
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
  recent: {},

  // Guarded: Dockview announces the active panel again whenever the centre remounts — usually
  // the same value, and every `set` wakes every subscriber.
  activate: id => {
    const state = get()
    if (state.activeId === id) return

    const workspace = id === null ? undefined : state.documents[id]?.workspace
    set({
      activeId: id,
      ...(workspace && id ? { recent: { ...state.recent, [workspace]: id } } : {}),
    })
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

    const inFolder = found ?? []
    const shown = panelIds(useLayouts.getState().layout)
    // One `set` for both halves: the folder says which documents exist, the layout says which
    // are open, and between two writes every tab would paint and unpaint.
    const documents = Object.fromEntries(
      inFolder.filter(document => shown.has(document.id)).map(document => [document.id, document]),
    )

    set(state => ({
      documents,
      stored: sorted(inFolder),
      // Kept when the tab survived the load: Dockview announces the active panel on mount, and
      // that happens before this listing comes back — clearing it here would leave every tool
      // window looking at nothing while a document is plainly open.
      activeId: state.activeId && documents[state.activeId] ? state.activeId : null,
    }))

    return found !== null
  },

  create: async (workspace, of) => {
    const kind = kindForWorkspace(workspace)
    if (!kind) return null

    // The listing FIRST, so that reading the store and writing to it happen in one synchronous
    // run. An await between the two makes concurrent creations blind to each other: both read a
    // store neither has written to yet, and two tabs open called « Sans titre 1 ».
    const stored = of ? [] : ((await listed()) ?? [])

    const title =
      of?.title ??
      untitledDocumentName(takenDocumentNames({ documents: get().documents, stored }), kind)

    const document: DocumentDescriptor = {
      id: newId(),
      kind,
      workspace,
      title,
      // Where it WOULD go, nothing having been written yet — the folder its author picked, and
      // what `saveDocument` hands the writer. Not a second answer disagreeing with the disk
      // (there is no file to disagree with), and the first save answers for good: it may land on
      // a suffixed name if the folder meanwhile took this one, and `relist` reads back what the
      // folder holds.
      path: documentPathFor(title, kind, of?.folder),
      ...(of?.sourceAssetId ? { sourceAssetId: of.sourceAssetId } : {}),
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

  rename: async (id, title) => {
    const document = documentById(get(), id)
    if (!document) return 'invalid'

    // Asked here as well as in the main process, and neither is the redundant one: this spares a
    // round trip for what the window can already see, and the main process is what makes the
    // refusal true whatever the window believed.
    // In the folder the document SITS in, which is where its new name has to be free.
    const taken = takenDocumentNames(
      { documents: {}, stored: get().stored },
      parentOf(document.path) ?? '',
    )
    const refused = checkDocumentName(title, document.kind, taken, id)
    if (refused) return refused

    const bridge = getBridge()
    if (!bridge) return 'invalid'

    let renamed
    try {
      renamed = await bridge.documents.rename(id, document.kind, title)
    } catch (error) {
      return asNameFailure(error)
    }

    if (typeof renamed === 'string') return renamed

    // Both halves, and that is the point of doing it here: `documents` is what the tab reads and
    // `stored` is what the Explorer and the document list read, so writing one leaves the other
    // showing the name the document has just stopped having.
    set(state => ({
      documents: state.documents[id] ? { ...state.documents, [id]: renamed } : state.documents,
      stored: state.stored.map(entry => (entry.id === id ? renamed : entry)),
    }))
    return null
  },

  close: id =>
    set(state => {
      const remaining = { ...state.documents }
      delete remaining[id]
      return { documents: remaining, activeId: state.activeId === id ? null : state.activeId }
    }),
}))

/** The four refusals travel as the error's message; anything else is not one of them. */
function asNameFailure(error: unknown): DocumentNameFailure {
  return nameFailureOf(error, DOCUMENT_NAME_FAILURES, 'invalid')
}

/**
 * Whether the centre is showing this document, subscribed. A hidden tab stays MOUNTED, so whatever
 * answers the window rather than a document — a menu row, a shortcut scope, the video return — has
 * to be armed on the tab in front and on no other.
 */
export function useDocumentIsInFront(documentId: string): boolean {
  return useDocuments(state => state.activeId === documentId)
}

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
 * Every name already spoken for — the folder's and the open tabs' alike.
 *
 * The FILE names, and every document's rather than the blank ones of one workspace: what makes a
 * name unusable is that the folder already holds it, whoever holds it. The open tabs count as
 * much as the folder, and one of them is why: a tab opened and not yet typed in writes no file,
 * so a listing alone would hand its name straight out a second time.
 *
 * The listing is handed in rather than read off the store: `create` has to read the store and
 * write to it in one synchronous run, and it holds a fresher listing than the one `stored` has.
 */
export function takenDocumentNames(
  state: {
    documents: Record<string, DocumentDescriptor>
    stored: readonly DocumentDescriptor[]
  },
  folder: string = DOCUMENTS_FOLDER,
): NamedDocument[] {
  // One folder, never the project: two folders may each hold a `Niveau.gltf` and the disk is
  // happy with both, so a name taken elsewhere in the tree is not taken here. The default is
  // where a document nobody has placed goes, which is what every caller of this asks about.
  return [...state.stored, ...Object.values(state.documents)]
    .filter(document => (parentOf(document.path) ?? '') === folder)
    .map(({ id, path }) => ({ id, fileName: nameOf(path) }))
}

/**
 * The next free name for a blank document — « Scène 3 ». What the studio proposes when it makes
 * one, and what the naming dialog opens on.
 *
 * Named after its KIND rather than « Sans titre », and the folder is why: the number is free per
 * FILE name, so the six kinds each held a « Sans titre 1 » a glyph alone told apart.
 */
export function untitledDocumentName(taken: readonly NamedDocument[], kind: DocumentKind): string {
  const names = new Set(taken.map(document => foldForFileName(document.fileName)))
  // Composed, hence `COMPOSED_KEYS` — and read once, the word being the same at every number.
  const called = i18next.t(`documents.kinds.${kind}`)

  // Ends on the first free one, and there are only ever as many taken as the folder holds. A
  // document opened for an asset is skipped like any other: « Image 1 » is a name one may wear.
  for (let n = 1; ; n += 1) {
    const title = i18next.t('documents.untitled', { kind: called, n })
    if (!names.has(foldForFileName(documentFileName(title, kind)))) return title
  }
}

/**
 * What an export of this document is named — its own title, down to what a file system holds.
 * Cleaned on THIS side because the main process refuses rather than repairs: a title holding a
 * separator reaches a channel as a path, and comes back rejected with nothing on screen to say so.
 */
export function documentExportName(
  state: DocumentsSlice,
  documentId: string,
  fallback: string,
): string {
  return safeFileName(state.documents[documentId]?.title ?? '', fallback)
}

/**
 * Sorted by title rather than by whatever order the folder was read in: a listing that
 * reshuffles between two reads is a list nobody can point at.
 *
 * In the reader's language, and not in the machine's: left bare, `localeCompare` answers in the
 * locale the OS was installed in, so the same project listed two orders on two desks — measured,
 * a Swedish one files `Ärger` past `Zoo`.
 *
 * Through `resolveLanguage` rather than on `i18next.language` raw, and that is not belt and braces:
 * the field is `undefined` until `initI18n` resolves, and it reads `pseudo` whenever the DEV
 * pseudo-locale flag is set. Measured, `new Intl.Collator(undefined)` and `new Intl.Collator
 * ('pseudo')` both resolve to `en-US` — handing the sort straight back to the machine, which is
 * the whole defect this call was fixed for.
 */
function sorted(found: readonly DocumentDescriptor[]): DocumentDescriptor[] {
  const language = resolveLanguage(i18next.language)
  return [...found].sort((left, right) => left.title.localeCompare(right.title, language))
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
