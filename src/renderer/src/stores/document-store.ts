import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
  discardLast,
  emptyHistory,
  forget,
  markOf as historyMark,
  redo,
  run,
  runCoalescing,
  undo,
  type Command,
  type History,
} from '@/engines/core/history'

/**
 * One state and **one history per document**, as spec §8.3 requires: ⌘Z undoes the last action
 * of the active document, not of whatever was edited last anywhere.
 */
export type DocumentStoreState<S> = {
  states: Record<string, S>
  histories: Record<string, History<S>>
  /** The command each document was written to disk at — see `markOf`. */
  saved: Record<string, Command<S> | null>
  runCommand: (documentId: string, command: Command<S>) => void
  /**
   * Writes a command that belongs to nobody's gesture — a job that lands whenever it lands, a
   * picture dropped on a document.
   *
   * The store cannot tell where a command came from, and no rule on `command.id` can: provenance
   * has to be said. Said, such a command neither merges into an open gesture nor takes it over —
   * two generations landing while a cursor is held stay two entries, and the cursor goes on
   * collapsing into its own.
   */
  runOutsideGesture: (documentId: string, command: Command<S>) => void
  /**
   * Opens a gesture: from here until `endGesture`, successive commands of the same edit collapse
   * into one history entry. A slider dragged across a panel is one thing the user did, and ⌘Z
   * has to give all of it back at once.
   */
  beginGesture: (documentId: string) => void
  endGesture: (documentId: string) => void
  /** Writes without touching the history — selection is not a command. */
  replace: (documentId: string, state: S) => void
  /** `discardLast` of `history.ts`, on this document. */
  discardLast: (documentId: string) => void
  /** `forget` of `history.ts`, on this document — for a patch the engine can no longer replay. */
  forgetThrough: (documentId: string, commandId: string) => void
  /**
   * Installs a starting state on first open, built rather than shared: a scene needs its own
   * node ids, which a constant default cannot give it. Idempotent — reopening a tab must not
   * reset what is in it.
   */
  ensure: (documentId: string, create: () => S) => void
  /**
   * Records the history position a write put on disk. The position is read before the write and
   * handed back after it — see `markOf` — so an edit made while the file was being written is
   * not counted as saved.
   */
  markSaved: (documentId: string, at: Command<S> | null) => void
  undo: (documentId: string) => void
  redo: (documentId: string) => void
  drop: (documentId: string) => void
}

type Readable<S> = Pick<DocumentStoreState<S>, 'states' | 'histories' | 'saved'>

/**
 * A space's store, as anything generic over spaces sees it. Spelled out rather than inferred so
 * that `document-io` can take one as an argument: five kinds reach the disk the same way, and
 * the alternative was that mechanism written out once per kind.
 */
export type DocumentStore<S> = {
  use: UseBoundStore<StoreApi<DocumentStoreState<S>>>
  stateOf: (state: Readable<S>, documentId: string) => S
  hasState: (state: Readable<S>, documentId: string) => boolean
  historyOf: (state: Readable<S>, documentId: string) => History<S>
  markOf: (state: Readable<S>, documentId: string) => Command<S> | null
  isDirty: (state: Readable<S>, documentId: string) => boolean
  hasUnsavedWork: (state: Readable<S>, documentId: string) => boolean
}

/**
 * The per-document state, history and undo/redo shared by every editable space. Canvases and
 * scenes differ only in what they hold: the bookkeeping around it is the same, and writing it
 * twice meant a fix landing in one space and not the other.
 */
export function createDocumentStore<S>(defaultState: S): DocumentStore<S> {
  // Shared: `historyOf` runs on every selector pass, and a fresh pair per call is garbage.
  const NO_HISTORY: History<S> = emptyHistory<S>()

  /**
   * Documents with a gesture open, each mapped to the id of the command already pushed for it —
   * `null` until the first one, so a gesture never merges into the entry left by the previous
   * one. Outside the store on purpose: no component renders it, and a `set` per pointer move
   * would notify every subscriber twice a frame.
   */
  const gestures = new Map<string, string | null>()

  /**
   * Documents this store has been told to forget, held until one is opened again. Outside the
   * store for the same reason as `gestures`, and read by `step`, which says what it protects.
   */
  const dropped = new Set<string>()

  const stateOf = (state: Readable<S>, documentId: string): S =>
    state.states[documentId] ?? defaultState

  /** Whether the document has a state at all — not the same question as what that state is. */
  const hasState = (state: Readable<S>, documentId: string): boolean =>
    state.states[documentId] !== undefined

  const historyOf = (state: Readable<S>, documentId: string): History<S> =>
    state.histories[documentId] ?? NO_HISTORY

  /** Where the document's history stands, as one value — see `markOf` in `history.ts`. */
  const markOf = (state: Readable<S>, documentId: string): Command<S> | null =>
    historyMark(historyOf(state, documentId))

  /**
   * Whether anything has been done since the document was last written. A document with no mark
   * at all reads `undefined`, which no history position ever equals — never saved is modified.
   *
   * This is what the tab's bullet reads, and "never written" is exactly what it must show.
   */
  const isDirty = (state: Readable<S>, documentId: string): boolean =>
    state.saved[documentId] !== markOf(state, documentId)

  /**
   * Whether closing this document would throw work away — a different question from `isDirty`,
   * and the one a confirmation dialog must ask.
   *
   * A tab opened and never touched is modified in the bullet's sense (nothing of it is on disk)
   * while holding nothing anyone would miss. Asking about it turns every stray ⌘W into a modal
   * question about a document that does not exist yet.
   */
  const hasUnsavedWork = (state: Readable<S>, documentId: string): boolean => {
    const never = state.saved[documentId] === undefined && markOf(state, documentId) === null
    return !never && isDirty(state, documentId)
  }

  const use = create<DocumentStoreState<S>>()((set, get) => {
    /**
     * `run`, `undo` and `redo` share one signature, so the three actions share one body: read
     * the document's pair, step it, write it back.
     *
     * A document that was CLOSED is left alone, and that guard is what keeps it from coming back:
     * `forgetDocument` drops the state and only THEN closes the panel, so every effect that
     * commits on its way out — the rename field is the one that does — runs after the document is
     * gone. Writing there would read the default state through `stateOf` and put it back as
     * `states[documentId]`, which reads as a document already open: the file would never be read
     * again, and the montage would reopen empty.
     *
     * Closed AND still gone, never one or the other. A document with no state yet is a normal
     * thing to write to — a generation claimed onto a canvas whose tab was never touched creates
     * it on the way in, and 28 cases across the stores describe that. And a document whose state
     * came back is open again whichever door it came through, including the `setState` a suite
     * installs its fixtures with.
     *
     * `forgetThrough` and `markSaved` write outside this path and are NOT guarded: called after a
     * drop they leave an entry behind in `histories` or `saved`. Nothing reads those for a
     * document with no state, so the leak is bookkeeping rather than behaviour.
     */
    const step = (
      documentId: string,
      apply: (state: S, history: History<S>) => [S, History<S>],
    ): void => {
      if (dropped.has(documentId) && !hasState(get(), documentId)) return

      const [next, history] = apply(stateOf(get(), documentId), historyOf(get(), documentId))
      set(state => ({
        states: { ...state.states, [documentId]: next },
        histories: { ...state.histories, [documentId]: history },
      }))
    }

    return {
      states: {},
      histories: {},
      saved: {},

      runCommand: (documentId, command) => {
        // `undefined` outside a gesture, `null` before its first command: neither is an id.
        const merging = gestures.get(documentId) === command.id
        step(documentId, (state, history) =>
          merging ? runCoalescing(state, history, command) : run(state, history, command),
        )
        if (gestures.has(documentId)) gestures.set(documentId, command.id)
      },

      runOutsideGesture: (documentId, command) =>
        step(documentId, (state, history) => run(state, history, command)),

      beginGesture: documentId => gestures.set(documentId, null),

      endGesture: documentId => gestures.delete(documentId),

      // Both are how a document ARRIVES — read from disk, or opened blank — so both take the id
      // back out of `dropped`: the same id is handed out again when a file is reopened.
      replace: (documentId, next) => {
        dropped.delete(documentId)
        set(state => ({ states: { ...state.states, [documentId]: next } }))
      },

      ensure: (documentId, create) => {
        dropped.delete(documentId)
        set(state =>
          state.states[documentId]
            ? state
            : { states: { ...state.states, [documentId]: create() } },
        )
      },

      markSaved: (documentId, at) =>
        set(state => ({ saved: { ...state.saved, [documentId]: at } })),

      // Deliberately leaves the open gesture alone: this is called from inside one, and closing
      // it would stop the rest of that gesture from coalescing — one history entry per frame.
      discardLast: documentId => step(documentId, discardLast),

      forgetThrough: (documentId, commandId) =>
        set(state => ({
          histories: {
            ...state.histories,
            [documentId]: forget(historyOf(state, documentId), commandId),
          },
        })),

      // Both close whatever gesture was open: the entry the next command would have merged into
      // is no longer the one the gesture started from.
      undo: documentId => {
        gestures.delete(documentId)
        step(documentId, undo)
      },

      redo: documentId => {
        gestures.delete(documentId)
        step(documentId, redo)
      },

      drop: documentId =>
        set(state => {
          gestures.delete(documentId)
          dropped.add(documentId)

          const states = { ...state.states }
          const histories = { ...state.histories }
          const saved = { ...state.saved }
          delete states[documentId]
          delete histories[documentId]
          delete saved[documentId]
          return { states, histories, saved }
        }),
    }
  })

  return { use, stateOf, hasState, historyOf, markOf, isDirty, hasUnsavedWork }
}
