/**
 * Generic Command history, shared by every engine. Command rather than snapshot: a stack of 4K
 * layers or a 200k-triangle mesh forbids photographing the state on every action.
 *
 * Pure functions rather than a mutable class — trivial to test, and it drops into a Zustand
 * store without a wrapper.
 */
export type Command<S> = {
  /** Identifies the kind of edit; two consecutive ones may later be merged on it. */
  id: string
  apply: (state: S) => S
  revert: (state: S) => S
}

export type History<S> = {
  past: Command<S>[]
  future: Command<S>[]
}

/** A session's worth of undo. Unbounded, the stack keeps every closure alive with it. */
export const HISTORY_LIMIT = 100

export function emptyHistory<S>(): History<S> {
  return { past: [], future: [] }
}

export function canUndo<S>(history: History<S>): boolean {
  return history.past.length > 0
}

export function canRedo<S>(history: History<S>): boolean {
  return history.future.length > 0
}

export function run<S>(state: S, history: History<S>, command: Command<S>): [S, History<S>] {
  const past = [...history.past, command].slice(-HISTORY_LIMIT)
  return [command.apply(state), { past, future: [] }]
}

export function undo<S>(state: S, history: History<S>): [S, History<S>] {
  const command = history.past.at(-1)
  if (!command) return [state, history]
  return [
    command.revert(state),
    { past: history.past.slice(0, -1), future: [command, ...history.future] },
  ]
}

export function redo<S>(state: S, history: History<S>): [S, History<S>] {
  const [command, ...rest] = history.future
  if (!command) return [state, history]
  return [command.apply(state), { past: [...history.past, command], future: rest }]
}
