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

/**
 * Runs a command as the continuation of the one before it, when both are the same edit of the
 * same node — which is what `id` says. Dragging a field emits dozens of values a second, and a
 * stack where ⌘Z gives back one pixel of a drag is a stack nobody can use.
 *
 * Only the caller knows whether two commands belong to the same gesture, so nothing here
 * decides it: `runCommand` merges while a gesture is open and never outside one, which is what
 * keeps two successive drags of the same field two entries.
 */
export function runCoalescing<S>(
  state: S,
  history: History<S>,
  command: Command<S>,
): [S, History<S>] {
  const last = history.past.at(-1)
  if (!last || last.id !== command.id) return run(state, history, command)

  return [
    command.apply(state),
    { past: [...history.past.slice(0, -1), coalesce(last, command)], future: [] },
  ]
}

/**
 * Applies where the gesture has got to, reverts where it began: the first command captured the
 * original value as it ran, and every command that merges into it sets an absolute value rather
 * than a step — so the last one alone describes the whole gesture forwards.
 */
function coalesce<S>(first: Command<S>, second: Command<S>): Command<S> {
  return { id: first.id, apply: second.apply, revert: first.revert }
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
