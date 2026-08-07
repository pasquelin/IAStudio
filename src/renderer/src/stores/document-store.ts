import { create } from 'zustand'
import {
  emptyHistory,
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
   * Opens a gesture: from here until `endGesture`, successive commands of the same edit collapse
   * into one history entry. A slider dragged across a panel is one thing the user did, and ⌘Z
   * has to give all of it back at once.
   */
  beginGesture: (documentId: string) => void
  endGesture: (documentId: string) => void
  /** Writes without touching the history — selection is not a command. */
  replace: (documentId: string, state: S) => void
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
 * The per-document state, history and undo/redo shared by every editable space. Canvases and
 * scenes differ only in what they hold: the bookkeeping around it is the same, and writing it
 * twice meant a fix landing in one space and not the other.
 */
export function createDocumentStore<S>(defaultState: S) {
  // Shared: `historyOf` runs on every selector pass, and a fresh pair per call is garbage.
  const NO_HISTORY: History<S> = emptyHistory<S>()

  /**
   * Documents with a gesture open, each mapped to the id of the command already pushed for it —
   * `null` until the first one, so a gesture never merges into the entry left by the previous
   * one. Outside the store on purpose: no component renders it, and a `set` per pointer move
   * would notify every subscriber twice a frame.
   */
  const gestures = new Map<string, string | null>()

  const stateOf = (state: Readable<S>, documentId: string): S =>
    state.states[documentId] ?? defaultState

  /** Whether the document has a state at all — not the same question as what that state is. */
  const hasState = (state: Readable<S>, documentId: string): boolean =>
    state.states[documentId] !== undefined

  const historyOf = (state: Readable<S>, documentId: string): History<S> =>
    state.histories[documentId] ?? NO_HISTORY

  /**
   * Where the document's history stands, as one value. The command it ended on, not a counter:
   * undoing back to where the file was written makes the document clean again, which a counter
   * would keep calling modified.
   */
  const markOf = (state: Readable<S>, documentId: string): Command<S> | null =>
    historyOf(state, documentId).past.at(-1) ?? null

  /**
   * Whether anything has been done since the document was last written. A document with no mark
   * at all reads `undefined`, which no history position ever equals — never saved is modified.
   */
  const isDirty = (state: Readable<S>, documentId: string): boolean =>
    state.saved[documentId] !== markOf(state, documentId)

  const use = create<DocumentStoreState<S>>()((set, get) => {
    /**
     * `run`, `undo` and `redo` share one signature, so the three actions share one body: read
     * the document's pair, step it, write it back.
     */
    const step = (
      documentId: string,
      apply: (state: S, history: History<S>) => [S, History<S>],
    ): void => {
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

      beginGesture: documentId => gestures.set(documentId, null),

      endGesture: documentId => gestures.delete(documentId),

      replace: (documentId, next) =>
        set(state => ({ states: { ...state.states, [documentId]: next } })),

      ensure: (documentId, create) =>
        set(state =>
          state.states[documentId]
            ? state
            : { states: { ...state.states, [documentId]: create() } },
        ),

      markSaved: (documentId, at) =>
        set(state => ({ saved: { ...state.saved, [documentId]: at } })),

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

  return { use, stateOf, hasState, historyOf, markOf, isDirty }
}
