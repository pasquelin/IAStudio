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
export type DocumentStoreState<S> = {
  states: Record<string, S>
  histories: Record<string, History<S>>
  saved: Record<string, Command<S> | null>
  runCommand: (documentId: string, command: Command<S>) => void
  runOutsideGesture: (documentId: string, command: Command<S>) => void
  beginGesture: (documentId: string) => void
  endGesture: (documentId: string) => void
  replace: (documentId: string, state: S) => void
  discardLast: (documentId: string) => void
  forgetThrough: (documentId: string, commandId: string) => void
  ensure: (documentId: string, create: () => S) => void
  markSaved: (documentId: string, at: Command<S> | null) => void
  undo: (documentId: string) => void
  redo: (documentId: string) => void
  drop: (documentId: string) => void
}
type Readable<S> = Pick<DocumentStoreState<S>, 'states' | 'histories' | 'saved'>
export type DocumentStore<S> = {
  use: UseBoundStore<StoreApi<DocumentStoreState<S>>>
  stateOf: (state: Readable<S>, documentId: string) => S
  hasState: (state: Readable<S>, documentId: string) => boolean
  historyOf: (state: Readable<S>, documentId: string) => History<S>
  markOf: (state: Readable<S>, documentId: string) => Command<S> | null
  isDirty: (state: Readable<S>, documentId: string) => boolean
  hasUnsavedWork: (state: Readable<S>, documentId: string) => boolean
  resetForTests: () => void
  forgetHistoriesForTests: () => void
}
const BUILT: {
  resetForTests: () => void
  forgetHistoriesForTests: () => void
}[] = []
export function resetDocumentStoresForTests(): void {
  for (const store of BUILT) store.resetForTests()
}
export function forgetDocumentHistoriesForTests(): void {
  for (const store of BUILT) store.forgetHistoriesForTests()
}
export function createDocumentStore<S>(defaultState: S): DocumentStore<S> {
  const NO_HISTORY: History<S> = emptyHistory<S>()
  const gestures = new Map<string, string | null>()
  const dropped = new Set<string>()
  const stateOf = (state: Readable<S>, documentId: string): S =>
    state.states[documentId] ?? defaultState
  const hasState = (state: Readable<S>, documentId: string): boolean =>
    state.states[documentId] !== undefined
  const historyOf = (state: Readable<S>, documentId: string): History<S> =>
    state.histories[documentId] ?? NO_HISTORY
  const markOf = (state: Readable<S>, documentId: string): Command<S> | null =>
    historyMark(historyOf(state, documentId))
  const isDirty = (state: Readable<S>, documentId: string): boolean =>
    state.saved[documentId] !== markOf(state, documentId)
  const hasUnsavedWork = (state: Readable<S>, documentId: string): boolean => {
    const never = state.saved[documentId] === undefined && markOf(state, documentId) === null
    return !never && isDirty(state, documentId)
  }
  const use = create<DocumentStoreState<S>>()((set, get) => {
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
        const merging = gestures.get(documentId) === command.id
        const before = historyOf(get(), documentId)
        step(documentId, (state, history) =>
          merging ? runCoalescing(state, history, command) : run(state, history, command),
        )
        if (gestures.has(documentId) && historyOf(get(), documentId) !== before) {
          gestures.set(documentId, command.id)
        }
      },
      runOutsideGesture: (documentId, command) =>
        step(documentId, (state, history) => run(state, history, command)),
      beginGesture: documentId => gestures.set(documentId, null),
      endGesture: documentId => gestures.delete(documentId),
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
      discardLast: documentId => step(documentId, discardLast),
      forgetThrough: (documentId, commandId) =>
        set(state => ({
          histories: {
            ...state.histories,
            [documentId]: forget(historyOf(state, documentId), commandId),
          },
        })),
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
  const resetForTests = (): void => {
    gestures.clear()
    dropped.clear()
    use.setState({ states: {}, histories: {}, saved: {} })
  }
  const forgetHistoriesForTests = (): void => {
    gestures.clear()
    use.setState(state => ({
      histories: {},
      saved: Object.fromEntries(Object.keys(state.saved).map(id => [id, null])),
    }))
  }
  const store = {
    use,
    stateOf,
    hasState,
    historyOf,
    markOf,
    isDirty,
    hasUnsavedWork,
    resetForTests,
    forgetHistoriesForTests,
  }
  BUILT.push(store)
  return store
}
