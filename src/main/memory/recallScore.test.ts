import { describe, expect, it } from 'vitest'
import type { Memory, MemoryRef } from '@shared/domain/assistantMemory'
import { rankedRecall, scoreOf, type RecallCandidate } from './recallScore'

const NOW = '2026-08-28T12:00:00.000Z'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_one',
  type: 'decision',
  summary: 'Cameras follow the rail',
  body: '',
  importance: 3,
  createdAt: NOW,
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

const order = (
  candidates: readonly RecallCandidate[],
  refs: readonly MemoryRef[] = [],
): readonly string[] => rankedRecall(candidates, { refs, now: NOW }).map(one => one.memory.id)

describe('what the four voices are each for', () => {
  /** An exact name — a file path, a uuid — is answered by words and by nothing else. */
  it('puts what the words found ahead of what only resembles', () => {
    expect(
      order([
        { memory: memory({ id: 'm_similar' }), similarity: 0.9 },
        { memory: memory({ id: 'm_exact' }), exactRank: 0 },
      ]),
    ).toEqual(['m_exact', 'm_similar'])
  })

  /** « pourquoi avions-nous décidé que… » is answered by meaning and by nothing else. */
  it('answers with what only resembles when the words found nothing', () => {
    expect(order([{ memory: memory({ id: 'm_similar' }), similarity: 0.6 }])).toEqual(['m_similar'])
  })

  /** What is on screen is not a guess, so it outranks both. */
  it('puts what the open document is anchored to ahead of everything', () => {
    const anchored = memory({ id: 'm_anchored', refs: [{ kind: 'scene', ref: 's_1' }] })

    expect(
      order(
        [{ memory: memory({ id: 'm_exact' }), exactRank: 0 }, { memory: anchored }],
        [{ kind: 'scene', ref: 's_1' }],
      ),
    ).toEqual(['m_anchored', 'm_exact'])
  })

  it('breaks a tie by importance, then by recency, then by id', () => {
    expect(
      order([
        { memory: memory({ id: 'm_b', importance: 1 }) },
        { memory: memory({ id: 'm_a', importance: 5 }) },
      ]),
    ).toEqual(['m_a', 'm_b'])

    expect(
      order([
        { memory: memory({ id: 'm_stale', usedAt: '2026-01-01T00:00:00.000Z' }) },
        { memory: memory({ id: 'm_fresh', usedAt: NOW }) },
      ]),
    ).toEqual(['m_fresh', 'm_stale'])

    // Stable, so a panel does not redraw its rows for no reason.
    expect(order([{ memory: memory({ id: 'm_b' }) }, { memory: memory({ id: 'm_a' }) }])).toEqual([
      'm_a',
      'm_b',
    ])
  })

  /** A memory written this morning is not stale, it is new — `createdAt` stands in. */
  it('reads recency off when it was written until it has been of use', () => {
    const never = memory({ createdAt: NOW })
    const long = memory({ createdAt: '2026-01-01T00:00:00.000Z' })

    expect(scoreOf({ memory: never }, { now: NOW })).toBeGreaterThan(
      scoreOf({ memory: long }, { now: NOW }),
    )
  })
})

describe('what the person decided to always give', () => {
  /** 🛑 Pinned is not a weight: no score may rank away what was pinned on purpose. */
  it('puts every pinned memory ahead of every other, whatever they scored', () => {
    expect(
      order([
        { memory: memory({ id: 'm_best' }), exactRank: 0, similarity: 1 },
        { memory: memory({ id: 'm_pinned', state: 'pinned', importance: 1 }) },
      ]),
    ).toEqual(['m_pinned', 'm_best'])
  })
})
