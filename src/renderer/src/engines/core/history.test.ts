import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  emptyHistory,
  HISTORY_LIMIT,
  redo,
  run,
  runCoalescing,
  undo,
  type Command,
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
