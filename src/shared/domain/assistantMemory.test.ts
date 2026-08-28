import { describe, expect, it } from 'vitest'
import {
  composedRecall,
  isPinned,
  isReadable,
  isRecallable,
  memoryLine,
  recallLength,
  type Memory,
  type MemoryState,
} from './assistantMemory'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_one',
  type: 'decision',
  summary: 'Cameras follow the rail, never the target',
  body: '',
  importance: 3,
  createdAt: '2026-08-28T10:00:00.000Z',
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

describe('one memory, as the model reads it', () => {
  it('leads with the id, which is what asks for the rest of it', () => {
    expect(memoryLine(memory())).toBe(
      '- m_one [decision] Cameras follow the rail, never the target',
    )
  })
})

describe('what a briefing carries', () => {
  it('says nothing at all when there is nothing to say', () => {
    expect(composedRecall([], 1000)).toBe('')
  })

  /**
   * 🛑 The defect this whole function exists to prevent: a decision cut in half reads as a
   * different decision, and nothing tells the model it was truncated.
   */
  it('drops a memory whole rather than cutting one in two', () => {
    const kept = memory({ id: 'm_one', summary: 'short one' })
    const dropped = memory({ id: 'm_two', summary: 'a very much longer sentence than the first' })
    const room = recallLength([kept]) + 4

    const block = composedRecall([kept, dropped], room)

    expect(block).toContain('m_one')
    expect(block).not.toContain('m_two')
    expect(block.length).toBeLessThanOrEqual(room)
  })

  it('holds nothing when not even the first memory fits under the heading', () => {
    expect(composedRecall([memory()], 10)).toBe('')
  })

  it('keeps the order it was handed, which is the ranking of whoever ranked it', () => {
    const lines = composedRecall([memory({ id: 'm_two' }), memory({ id: 'm_one' })], 1000).split(
      '\n',
    )

    expect(lines[1]).toContain('m_two')
    expect(lines[2]).toContain('m_one')
  })

  it('costs nothing when there is no memory, rather than the heading alone', () => {
    expect(recallLength([])).toBe(0)
  })

  it('measures what it would cost without composing it', () => {
    const memories = [memory({ id: 'm_one' }), memory({ id: 'm_two' })]

    expect(composedRecall(memories, 1000).length).toBe(recallLength(memories))
  })
})

describe('what each state allows', () => {
  const states: readonly [MemoryState, boolean, boolean][] = [
    ['live', true, true],
    ['pinned', true, true],
    ['archived', true, false],
    ['dropped', false, false],
  ]

  for (const [state, readable, recallable] of states) {
    it(`a ${state} memory is ${readable ? '' : 'not '}shown and is ${recallable ? '' : 'never '}recalled`, () => {
      expect(isReadable(memory({ state }))).toBe(readable)
      expect(isRecallable(memory({ state }))).toBe(recallable)
    })
  }

  it('only a pinned memory travels whatever the query found', () => {
    expect(isPinned(memory({ state: 'pinned' }))).toBe(true)
    expect(isPinned(memory({ state: 'live' }))).toBe(false)
  })
})
