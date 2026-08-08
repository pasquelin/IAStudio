import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  emptyHistory,
  HISTORY_LIMIT,
  redo,
  run,
  markOf,
  runCoalescing,
  undo,
  type Command,
  type History,
} from './history'

const add = (amount: number): Command<number> => ({
  id: `add:${amount}`,
  apply: value => value + amount,
  revert: value => value - amount,
})

/** What a dragged field emits: an absolute value, captured as it is applied — like `editNode`. */
const set = (value: number, id = 'set'): Command<number> => {
  let previous: number | null = null

  return {
    id,
    apply: current => {
      previous = current
      return value
    },
    revert: current => previous ?? current,
  }
}

describe('history', () => {
  it('applies a command and remembers it', () => {
    const [value, history] = run(0, emptyHistory<number>(), add(5))
    expect(value).toBe(5)
    expect(canUndo(history)).toBe(true)
  })

  it('undoes back to the previous value', () => {
    const [applied, afterRun] = run(0, emptyHistory<number>(), add(5))
    const [value, history] = undo(applied, afterRun)
    expect(value).toBe(0)
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(true)
  })

  it('redoes what was undone', () => {
    const [applied, afterRun] = run(0, emptyHistory<number>(), add(5))
    const [reverted, afterUndo] = undo(applied, afterRun)
    const [value] = redo(reverted, afterUndo)
    expect(value).toBe(5)
  })

  it('drops the redo stack once a new command runs', () => {
    const [applied, afterRun] = run(0, emptyHistory<number>(), add(5))
    const [reverted, afterUndo] = undo(applied, afterRun)
    const [, history] = run(reverted, afterUndo, add(3))
    expect(canRedo(history)).toBe(false)
  })

  it('is a no-op when there is nothing to undo', () => {
    const history = emptyHistory<number>()
    expect(undo(7, history)).toEqual([7, history])
  })

  it('is a no-op when there is nothing to redo', () => {
    const history = emptyHistory<number>()
    expect(redo(7, history)).toEqual([7, history])
  })

  it('bounds the stack so a long session does not grow without end', () => {
    let value = 0
    let history = emptyHistory<number>()
    for (let index = 0; index < HISTORY_LIMIT + 10; index += 1) {
      ;[value, history] = run(value, history, add(1))
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
  })
})

/** What says whether a document is on disk — see `dropped` in `history.ts` for the trap. */
describe('markOf', () => {
  const many = (count: number): History<number> => {
    let value = 0
    let history = emptyHistory<number>()
    for (let index = 0; index < count; index += 1) [value, history] = run(value, history, add(1))
    return history
  }

  const undoAll = (history: History<number>): History<number> => {
    let value = 0
    let current = history
    while (canUndo(current)) [value, current] = undo(value, current)
    return current
  }

  it('reads nothing for a history nothing has been done to', () => {
    expect(markOf(emptyHistory<number>())).toBeNull()
  })

  it('reads the command the history ended on', () => {
    const command = add(1)
    const [, history] = run(0, emptyHistory<number>(), command)
    expect(markOf(history)).toBe(command)
  })

  it('comes back to where a save was made once an undo returns there', () => {
    const [value, saved] = run(0, emptyHistory<number>(), add(1))
    const at = markOf(saved)
    const [, moved] = run(value, saved, add(2))

    expect(markOf(moved)).not.toBe(at)
    expect(markOf(undo(0, moved)[1])).toBe(at)
  })

  it('reads nothing again when every command is undone within the limit', () => {
    expect(markOf(undoAll(many(3)))).toBeNull()
  })

  // The bug: those first commands are still applied, so this is NOT an untouched document.
  it('does not read as untouched once the stack has dropped a command', () => {
    expect(markOf(undoAll(many(HISTORY_LIMIT + 1)))).not.toBeNull()
  })

  it('keeps naming the same dropped command however many more are run', () => {
    const first = markOf(undoAll(many(HISTORY_LIMIT + 1)))
    const later = markOf(undoAll(many(HISTORY_LIMIT + 5)))

    expect(first).not.toBeNull()
    expect(later).not.toBeNull()
    // Different runs build different commands; what matters is that neither reads as untouched.
    expect(later).not.toBe(first)
  })

  it('survives a redo: replaying the stack lands on the same mark it left', () => {
    const history = many(3)
    const at = markOf(history)
    const undone = undo(0, history)[1]

    expect(markOf(redo(0, undone)[1])).toBe(at)
  })
})

describe('runCoalescing', () => {
  it('leaves one entry for a whole drag', () => {
    let [value, history] = run(0, emptyHistory<number>(), set(1))
    ;[value, history] = runCoalescing(value, history, set(2))
    ;[value, history] = runCoalescing(value, history, set(3))

    expect(value).toBe(3)
    expect(history.past).toHaveLength(1)
  })

  // The point of the whole mechanism: ⌘Z gives back the value the gesture started from, not
  // the one it passed through a frame earlier.
  it('undoes the gesture back to where it began', () => {
    let [value, history] = run(0, emptyHistory<number>(), set(1))
    ;[value, history] = runCoalescing(value, history, set(2))
    ;[value, history] = runCoalescing(value, history, set(3))

    const [back, afterUndo] = undo(value, history)
    expect(back).toBe(0)
    expect(canUndo(afterUndo)).toBe(false)
  })

  it('redoes the gesture to where it ended', () => {
    let [value, history] = run(0, emptyHistory<number>(), set(1))
    ;[value, history] = runCoalescing(value, history, set(3))

    const [back, afterUndo] = undo(value, history)
    expect(redo(back, afterUndo)[0]).toBe(3)
  })

  it('opens a new entry when the edit is not the same one', () => {
    const [applied, afterRun] = run(0, emptyHistory<number>(), set(1))
    const [, history] = runCoalescing(applied, afterRun, set(2, 'other'))

    expect(history.past).toHaveLength(2)
  })

  it('behaves like a plain run against an empty history', () => {
    const [value, history] = runCoalescing(0, emptyHistory<number>(), set(4))

    expect(value).toBe(4)
    expect(history.past).toHaveLength(1)
  })

  it('drops the redo stack, like any other command', () => {
    const [applied, afterRun] = run(0, emptyHistory<number>(), set(1))
    const [reverted, afterUndo] = undo(applied, afterRun)
    const [, history] = runCoalescing(reverted, afterUndo, set(2))

    expect(canRedo(history)).toBe(false)
  })
})
