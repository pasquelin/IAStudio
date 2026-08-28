import { describe, expect, it } from 'vitest'
import { isReadable, type Memory, type MemoryState } from './assistantMemory'

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

describe('what each state allows', () => {
  const states: readonly [MemoryState, boolean][] = [
    ['live', true],
    ['pinned', true],
    ['archived', true],
    ['dropped', false],
  ]

  for (const [state, readable] of states) {
    it(`a ${state} memory is ${readable ? '' : 'not '}answered`, () => {
      expect(isReadable(memory({ state }))).toBe(readable)
    })
  }
})
