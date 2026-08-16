import { describe, expect, it } from 'vitest'
import { SUITE_SOURCES } from '@/design/test-harness'

/**
 * A suite emptying a document store by hand — a `setState` handing the store an empty `states`
 * map, as thirty-four of them did before the setup emptied it for every case. Each was a defect
 * waiting: `setState` MERGES, so it left the closed-document marks the store keeps outside its
 * state, and a document one case closed silenced the commands of every case after it.
 *
 * They are all gone, and the setup covers both renderer projects. What this stops is the
 * thirty-fifth — written in good faith by someone who has no reason to know any of the above,
 * and which would fail nothing until it wasted an afternoon.
 *
 * The form is spelled here as a pattern rather than as an example on purpose: a guard that reads
 * text matches its own comment, and would have reported itself.
 */
const HANDS_OVER_STATES = String.raw`\.setState\([\s\S]{0,120}?states:\s*\{\s*`

/** Handing it an EMPTY map. Lazy up to the key, so the map is the one nearest the call. */
const HAND_WRITTEN_RESET = new RegExp(`${HANDS_OVER_STATES}\\}`)

describe('a suite that empties a document store', () => {
  it('leaves it to the setup rather than writing it out', () => {
    const offenders = SUITE_SOURCES.filter(([, source]) => HAND_WRITTEN_RESET.test(source)).map(
      ([path]) => path,
    )

    expect(offenders).toEqual([])
  })

  /**
   * The rule reads text, so it would go quiet the day the form changes rather than the day the
   * defect returns. This says the form is still the one written across the repo — installing a
   * document IS the neighbouring form, and no rule forbids it.
   */
  it('is watching a form suites still write', () => {
    const installing = new RegExp(`${HANDS_OVER_STATES}\\[?['a-zA-Z]`)

    expect(SUITE_SOURCES.filter(([, source]) => installing.test(source)).length).toBeGreaterThan(0)
  })
})
