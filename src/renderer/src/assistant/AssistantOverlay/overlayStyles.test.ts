import { describe, expect, it } from 'vitest'
import { spellsOut, WRITTEN_SOURCES } from '@/design/testHarness'
import { OVERLAY_CARD } from './overlayStyles'

/** As `WRITTEN_SOURCES` keys it: the glob resolves against `design/testHarness.ts`. */
const GUARDED = '../assistant/AssistantOverlay/overlayStyles.ts'

/**
 * The radius is left out on purpose: the two copies this constant replaces agreed on all eight
 * other words and differed on THAT one. A rule demanding the whole set would walk past the very
 * drift it exists to catch.
 */
const spellsOutCard = spellsOut(OVERLAY_CARD.split(' ').filter(one => !one.startsWith('rounded-')))

describe('the card of the assistant overlay', () => {
  it('finds the sources and the constant at all, so the rule below cannot pass on nothing', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
    expect(WRITTEN_SOURCES.map(([path]) => path)).toContain(GUARDED)
    expect(spellsOutCard(`className="${OVERLAY_CARD}"`)).toBe(true)
  })

  it('is worn rather than written out a third time', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutCard(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
