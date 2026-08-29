import { describe, expect, it } from 'vitest'
import { ACTION_REGISTRY, type ActionName } from '@shared/domain/assistant'
import { COVERAGE, rankOf, uncoveredActions } from './coverage'
import { SCENARIOS } from './scenarios'

/**
 * 🛑 A tool the batterie never reaches is a tool nobody has seen work. `coverage.ts`'s `Record`
 * stops an action being added without an answer; what is left here is a rank naming no scenario,
 * and the roll of what is measured by nothing — written out, because a count hides a swap.
 */

/**
 * Actions no request exercises — empty, and to stay empty. 🛑 A list and not a count, so an
 * action added with `[]` turns the gate red by NAME rather than by a number nobody can act on.
 */
const AWAITING: readonly ActionName[] = []

describe('the MCP surface and the batterie', () => {
  /**
   * 🛑 The whole REGISTRY, not the MCP wire: the bench drives `runConfirmedAction`, so it
   * measures actions the wire never carries too — `reach: 'window'` is one, and left out here it
   * would be the only action of the studio nothing has to answer for.
   */
  it('names every action the registry holds', () => {
    const held = ACTION_REGISTRY.map(one => one.name)
    const named = Object.keys(COVERAGE)

    expect([...named].sort()).toEqual([...held].sort())
  })

  it('cites only ranks the batterie actually carries', () => {
    const ranks = new Set(SCENARIOS.map(one => rankOf(one.name)))
    const ghosts = Object.entries(COVERAGE).flatMap(([action, cited]) =>
      cited.filter(rank => !ranks.has(rank)).map(rank => `${action} → ${rank}`),
    )

    expect(ghosts).toEqual([])
  })

  // Sorted on both sides: the table reads in registry order, which is worth keeping, and a
  // reordering there is not a coverage change.
  it('leaves exactly these actions measured by nothing', () => {
    expect([...uncoveredActions()].sort()).toEqual([...AWAITING].sort())
  })
})
