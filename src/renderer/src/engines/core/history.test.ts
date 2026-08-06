import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  emptyHistory,
  HISTORY_LIMIT,
  redo,
  run,
  undo,
  type Command,
} from './history'

const add = (amount: number): Command<number> => ({
  id: `add:${amount}`,
  apply: value => value + amount,
  revert: value => value - amount,
})

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
