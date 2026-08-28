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
    count: async () => found.length,
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

describe('what answers a question put to the memory', () => {
  it('answers the memories, best first', async () => {
    const stood = stand({ found: [memory('m_a', 'the rail'), memory('m_b', 'the palette')] })

    const found = await stood.vectors.recall('project', { text: 'why the rail?' })

    expect(found.map(one => one.summary)).toEqual(['the rail', 'the palette'])
  })

  /** What was served is what later ages — see `RECALL_WEIGHTS`. */
  it('stamps what it served', async () => {
    const stood = stand({ found: [memory('m_a', 'the rail')] })
    await stood.vectors.recall('project', { text: 'why the rail?' })

    await vi.waitFor(() => expect(stood.used).toEqual([['m_a']]))
  })

  /**
   * 🛑 The question is EMBEDDED here and nowhere else: a recall that skipped this would rank on
   * words alone, which is the filter this call exists not to be.
   */
  it('embeds the question against the model whose vectors it compares', async () => {
    const stood = stand({ found: [memory('m_a', 'the rail')] })
    await stood.vectors.recall('project', { text: 'why the rail?' })

    expect(stood.asked[0]).toMatchObject({ model: 'e' })
    expect(stood.asked[0]).toHaveProperty('question')
  })

  /** A studio with no embedding model pays nothing for the attempt and searches on words. */
  it('asks no question of a model that is not there', async () => {
    const stood = stand({ found: [], model: null })
    await stood.vectors.recall('project', { text: 'why the rail?' })

    expect(stood.asked[0]).not.toHaveProperty('question')
  })

  /**
   * 🛑 What the briefing pays instead of a recall: no embedding, no vector compared, no row read.
   */
  it('counts what a scope holds without asking a question of it', async () => {
    const stood = stand({ found: [memory('m_a', 'the rail'), memory('m_b', 'the palette')] })

    await expect(stood.vectors.held('project')).resolves.toBe(2)
    expect(stood.asked).toEqual([])
  })

  /**
   * 🛑 A dead embedder must cost the answer and never the turn that asked for it: a client gets
   * an empty recall and a line in the journal.
   */
  it('answers nothing rather than failing when the memory or the embedder is gone', async () => {
    const stood = stand({ failing: true })

    await expect(stood.vectors.recall('project', { text: 'why?' })).resolves.toEqual([])
    expect(stood.troubles).toHaveLength(1)
  })
})
