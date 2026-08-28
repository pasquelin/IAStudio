import { describe, expect, it, vi } from 'vitest'
import type { Memory } from '@shared/domain/assistantMemory'
import type { AsyncMemory } from './memoryClient'
import type { Embedder } from './embedder'
import type { MemoryHost } from './memoryHost'
import { createMemoryVectors, type MemoryVectors } from './memoryVectors'

const memory = (id: string, summary: string): Memory => ({
  id,
  type: 'decision',
  summary,
  body: '',
  importance: 3,
  createdAt: '2026-08-28T10:00:00.000Z',
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
})

function stand({
  found = [] as readonly Memory[],
  failing = false,
  model = 'e' as string | null,
} = {}): { vectors: MemoryVectors; troubles: string[]; used: string[][]; asked: unknown[] } {
  const troubles: string[] = []
  const used: string[][] = []
  const asked: unknown[] = []

  const project = {
    recall: async (ask: unknown) => {
      asked.push(ask)
      if (failing) throw new Error('the memory thread exited with code 1')
      return found
    },
    markUsed: async (ids: readonly string[]) => {
      used.push([...ids])
    },
  } as unknown as AsyncMemory

  const embedder: Embedder = {
    chosen: () => model,
    embed: async () => [],
    embedQuery: async () => {
      if (failing) throw new Error('the embedding process exited with code 1')
      return new Float32Array([1, 0])
    },
    close: async () => {},
  }

  return {
    troubles,
    used,
    asked,
    vectors: createMemoryVectors({
      host: { of: async () => project } as unknown as MemoryHost,
      embedder,
      onProgress: () => {},
      onTrouble: why => troubles.push(why),
    }),
  }
}

describe('what the assistant is reminded of', () => {
  it('answers the summaries, one a line, best first', async () => {
    const stood = stand({ found: [memory('m_a', 'the rail'), memory('m_b', 'the palette')] })

    await expect(stood.vectors.recalled('why the rail?', [], 1000)).resolves.toBe(
      '  the rail\n  the palette',
    )
  })

  /** What was served is what later ages — see `RECALL_WEIGHTS`. */
  it('stamps what it served', async () => {
    const stood = stand({ found: [memory('m_a', 'the rail')] })
    await stood.vectors.recalled('why the rail?', [], 1000)

    await vi.waitFor(() => expect(stood.used).toEqual([['m_a']]))
  })

  /** 🛑 The budget is a hard ceiling, and it cuts by whole memories. */
  it('keeps only what fits the room, and nothing at all for no room', async () => {
    const stood = stand({ found: [memory('m_a', 'aaaa'), memory('m_b', 'bbbb')] })

    await expect(stood.vectors.recalled('x', [], 8)).resolves.toBe('  aaaa')
    await expect(stood.vectors.recalled('x', [], 0)).resolves.toBe('')
  })

  /** A studio with no embedding model pays nothing for the attempt and searches on words. */
  it('asks no question of a model that is not there', async () => {
    const stood = stand({ found: [], model: null })
    await stood.vectors.recalled('why the rail?', [], 1000)

    expect(stood.asked[0]).not.toHaveProperty('question')
  })

  /**
   * 🛑 `brainRouted` awaits this in the same `Promise.all` as the provider: a rejection here
   * would kill the TURN, and the window would mark it lost — over a reminder.
   */
  it('answers nothing rather than failing when the memory or the embedder is gone', async () => {
    const stood = stand({ failing: true })

    await expect(stood.vectors.recalled('why the rail?', [], 1000)).resolves.toBe('')
    expect(stood.troubles).toHaveLength(1)
  })
})
