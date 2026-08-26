import type { PathChange } from '@shared/domain/fileOp'
import { inverseOf, type FileAct } from './filePlan'

/**
 * How many batches one project may take back — thirty-two is far past what a hand undoes in one
 * sitting, and the whole of it costs less than one thumbnail.
 *
 * Not `renderer/engines/core/history.ts`, which holds the same bounded past/future: its
 * `Command.apply/revert` are SYNCHRONOUS over an in-memory state, where these batches are
 * asynchronous and write to a disk, and it lives on the far side of the bridge.
 */
export const UNDO_DEPTH = 32

/** The two piles a file gesture moves between. */
export type UndoStacks = {
  readonly past: readonly (readonly PathChange[])[]
  readonly future: readonly (readonly PathChange[])[]
}

/**
 * The acts that put a whole batch back, in the order they have to run.
 *
 * Reversed as well as inverted: a batch that moved `a` out of the way and then `b` into its
 * place has to be taken back in the other order, or the second inverse lands on a name the
 * first has not freed yet.
 */
export function inverseBatch(batch: readonly PathChange[]): FileAct[] {
  return [...batch].reverse().flatMap(change => inverseOf(change) ?? [])
}

/**
 * One step of the piles, in either direction — the same move with the two swapped.
 *
 * `replay` is the only half that differs between a disk and a Map, which is why it is passed:
 * what a step MEANS is one rule, and a second copy of it drifted twice before this existed.
 *
 * Taken off the pile it came from whatever happened — a batch that could not be replayed cannot
 * be replayed on the next press either. Pushed onto the OTHER pile only where something moved:
 * an empty batch across lights « Rétablir » for an action that does not exist, then lights
 * « Annuler » again when it is pressed, for ever.
 */
export async function steppedStacks(
  stacks: UndoStacks,
  way: 'undo' | 'redo',
  replay: (batch: readonly PathChange[]) => Promise<readonly PathChange[]>,
): Promise<{ stacks: UndoStacks; done: readonly PathChange[] }> {
  const from = way === 'undo' ? stacks.past : stacks.future
  const batch = from.at(-1)
  if (!batch) return { stacks, done: [] }

  const done = await replay(batch)
  const kept = from.slice(0, -1)
  const onto = [
    ...(way === 'undo' ? stacks.future : stacks.past),
    ...(done.length > 0 ? [done] : []),
  ].slice(-UNDO_DEPTH)

  return {
    stacks: way === 'undo' ? { past: kept, future: onto } : { past: onto, future: kept },
    done,
  }
}
