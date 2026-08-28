import { describe, expect, it } from 'vitest'
import type { Memory } from './assistantMemory'
import { duplicatesIn, staleIn } from './memoryUpkeep'

const NOW = '2026-08-28T12:00:00.000Z'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_one',
  type: 'decision',
  summary: 'Les caméras suivent le rail',
  body: '',
  importance: 3,
  createdAt: '2026-08-01T10:00:00.000Z',
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

describe('what says the same thing twice', () => {
  it('groups a rewording with what it repeats', () => {
    const groups = duplicatesIn([
      memory({ id: 'm_a' }),
      memory({ id: 'm_b', summary: 'les cameras suivent le rail !' }),
      memory({ id: 'm_c', summary: 'something else entirely' }),
    ])

    expect(groups.map(group => group.map(one => one.id))).toEqual([['m_a', 'm_b']])
  })

  /** Importance is what somebody decided; a date is only what happened last. */
  it('puts the one worth keeping first, by importance and then by recency', () => {
    const groups = duplicatesIn([
      memory({ id: 'm_old', importance: 5, createdAt: '2026-01-01T00:00:00.000Z' }),
      memory({ id: 'm_new', importance: 2, createdAt: '2026-08-20T00:00:00.000Z' }),
      memory({ id: 'm_mid', importance: 5, createdAt: '2026-08-25T00:00:00.000Z' }),
    ])

    expect(groups[0]?.map(one => one.id)).toEqual(['m_mid', 'm_old', 'm_new'])
  })

  it('says nothing about a memory that stands alone', () => {
    expect(duplicatesIn([memory()])).toEqual([])
  })

  /** Two things said in the same words about different natures are two different things. */
  it('never groups across types', () => {
    expect(duplicatesIn([memory({ id: 'm_a' }), memory({ id: 'm_b', type: 'problem' })])).toEqual(
      [],
    )
  })

  it('leaves a forgotten memory out: there is nothing to merge into it', () => {
    expect(duplicatesIn([memory({ id: 'm_a' }), memory({ id: 'm_b', state: 'dropped' })])).toEqual(
      [],
    )
  })
})

describe('what nothing has drawn on', () => {
  const long = '2026-01-01T00:00:00.000Z'

  it('names a memory nothing has served for a season, oldest first', () => {
    const found = staleIn(
      [
        memory({ id: 'm_fresh', usedAt: NOW }),
        memory({ id: 'm_old', usedAt: long }),
        memory({ id: 'm_older', usedAt: '2025-06-01T00:00:00.000Z' }),
      ],
      NOW,
    )

    expect(found.map(one => one.id)).toEqual(['m_older', 'm_old'])
  })

  /** 🛑 Pinning IS the decision that it never goes stale. */
  it('never names a pinned memory, however long it has sat', () => {
    expect(staleIn([memory({ state: 'pinned', usedAt: long })], NOW)).toEqual([])
  })

  it('never names one that is already archived', () => {
    expect(staleIn([memory({ state: 'archived', usedAt: long })], NOW)).toEqual([])
  })

  /** A memory never served is as old as it is — `createdAt` stands in for `usedAt`. */
  it('reads how old one is off when it was written, until something has served it', () => {
    expect(staleIn([memory({ createdAt: long })], NOW).map(one => one.id)).toEqual(['m_one'])
    expect(staleIn([memory({ createdAt: long, usedAt: NOW })], NOW)).toEqual([])
  })
})
