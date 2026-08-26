import { describe, expect, it } from 'vitest'
import type { PathChange } from '@shared/domain/fileOp'
import { inverseBatch, steppedStacks, UNDO_DEPTH } from './fileStacks'

const moved = (from: string, to: string): PathChange => ({ from, to })

describe('inverseBatch', () => {
  /**
   * 🛑 A batch that moved `a` out of the way and then `b` into its place has to be taken back in
   * the other order, or the second inverse lands on a name the first has not freed yet.
   */
  it('puts a batch back in the reverse order', () => {
    const acts = inverseBatch([moved('a.png', 'tmp.png'), moved('b.png', 'a.png')])

    expect(acts).toEqual([
      { act: 'move', from: 'a.png', to: 'b.png' },
      { act: 'move', from: 'tmp.png', to: 'a.png' },
    ])
  })

  it('drops a change the trash left with no inverse', () => {
    expect(inverseBatch([{ from: 'gone.png', to: '' }])).toEqual([])
  })
})

describe('steppedStacks', () => {
  it('answers the same piles when the one asked is empty', async () => {
    const stacks = { past: [], future: [[moved('a', 'b')]] }
    const stepped = await steppedStacks(stacks, 'undo', async () => [])

    expect(stepped.stacks).toBe(stacks)
    expect(stepped.done).toEqual([])
  })

  it('moves a batch that replayed onto the other pile', async () => {
    const batch = [moved('a.png', 'b.png')]
    const stepped = await steppedStacks({ past: [batch], future: [] }, 'undo', async () => [
      moved('b.png', 'a.png'),
    ])

    expect(stepped.stacks.past).toEqual([])
    expect(stepped.stacks.future).toEqual([[moved('b.png', 'a.png')]])
  })

  /**
   * 🛑 An empty batch pushed across lights « Rétablir » for an action that does not exist — then
   * lights « Annuler » again when it is pressed, for ever.
   */
  it('drops a batch that replayed nothing rather than pushing it across', async () => {
    const stepped = await steppedStacks(
      { past: [[moved('a', 'b')]], future: [] },
      'undo',
      async () => [],
    )

    expect(stepped.stacks.past).toEqual([])
    expect(stepped.stacks.future).toEqual([])
  })

  it('takes a redo back to the past pile', async () => {
    const stepped = await steppedStacks(
      { past: [], future: [[moved('b', 'a')]] },
      'redo',
      async () => [moved('a', 'b')],
    )

    expect(stepped.stacks.future).toEqual([])
    expect(stepped.stacks.past).toEqual([[moved('a', 'b')]])
  })

  it('keeps the pile bounded at the depth a project may take back', async () => {
    const full = Array.from({ length: UNDO_DEPTH }, (_, at) => [moved(`${at}`, `${at}b`)])
    const stepped = await steppedStacks(
      { past: full, future: [[moved('x', 'y')]] },
      'redo',
      async () => [moved('y', 'z')],
    )

    expect(stepped.stacks.past).toHaveLength(UNDO_DEPTH)
  })
})
