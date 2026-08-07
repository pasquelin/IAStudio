import { create } from 'zustand'
import { emptyHistory, redo, run, undo, type Command, type History } from '@/engines/core/history'

/**
 * One state and **one history per document**, as spec §8.3 requires: ⌘Z undoes the last action
 * of the active document, not of whatever was edited last anywhere.
 */
export type DocumentStoreState<S> = {
  states: Record<string, S>
  histories: Record<string, History<S>>
  runCommand: (documentId: string, command: Command<S>) => void
  /** Writes without touching the history — selection is not a command. */
  replace: (documentId: string, state: S) => void
  undo: (documentId: string) => void
  redo: (documentId: string) => void
  drop: (documentId: string) => void
}

type Readable<S> = Pick<DocumentStoreState<S>, 'states' | 'histories'>

/**
 * The per-document state, history and undo/redo shared by every editable space. Canvases and
 * scenes differ only in what they hold: the bookkeeping around it is the same, and writing it
 * twice meant a fix landing in one space and not the other.
 */
export function createDocumentStore<S>(defaultState: S) {
  // Shared: `historyOf` runs on every selector pass, and a fresh pair per call is garbage.
  const NO_HISTORY: History<S> = emptyHistory<S>()

  const stateOf = (state: Readable<S>, documentId: string): S =>
    state.states[documentId] ?? defaultState

  const historyOf = (state: Readable<S>, documentId: string): History<S> =>
    state.histories[documentId] ?? NO_HISTORY

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

      runCommand: (documentId, command) =>
        step(documentId, (state, history) => run(state, history, command)),

      replace: (documentId, next) =>
        set(state => ({ states: { ...state.states, [documentId]: next } })),

      undo: documentId => step(documentId, undo),

      redo: documentId => step(documentId, redo),

      drop: documentId =>
        set(state => {
          const states = { ...state.states }
          const histories = { ...state.histories }
          delete states[documentId]
          delete histories[documentId]
          return { states, histories }
        }),
    }
  })

  return { use, stateOf, historyOf }
}
