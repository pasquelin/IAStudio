import { describe, expect, it } from 'vitest'
import { dayOf, isUsageRoute, USAGE_ROUTE } from './usage'

describe('the day a usage point falls on', () => {
  it('takes the day off the stamp the API sent', () => {
    expect(dayOf('2026-08-13T09:15:00Z')).toBe('2026-08-13')
  })

  /**
   * The invariant its own name does not carry, and the one nothing distinguished before.
   *
   * `dayOf` was tested only through `periodBounds`, whose inputs are already built in UTC — so a
   * version reading the LOCAL day would have passed every case. This one cannot: the suite runs in
   * `Asia/Tokyo` (`vitest.config.ts`), where a stamp late in the UTC evening is already tomorrow
   * morning. A local reading answers `2026-08-14` and this goes red, which is the whole point.
   */
  it('answers the UTC day, not the day the machine is living', () => {
    const lateEvening = '2026-08-13T23:30:00Z'

    expect(dayOf(lateEvening)).toBe('2026-08-13')
    expect(new Date(lateEvening).getDate()).toBe(14)
  })

  // The window pairs this with its own formatters, and that pair is held in
  // `renderer/src/features/usage/components/Usage/format.test.ts` — this side only owes the rule.
  it('leaves a stamp already cut to a day alone', () => {
    expect(dayOf('2026-08-13')).toBe('2026-08-13')
  })

  /**
   * The case the first version failed, and it took a review to ask for it: ten characters off the
   * front are the day AS WRITTEN, which is the UTC day only while every stamp ends in `Z`.
   *
   * Both directions, because an offset moves the day either way — and both are the same defect: a
   * bar counted under one day beside a journal row printed under another.
   */
  it('converts a stamp carrying an offset instead of reading its first ten characters', () => {
    expect(dayOf('2026-08-14T05:00:00+09:00')).toBe('2026-08-13')
    expect(dayOf('2026-08-13T20:00:00-05:00')).toBe('2026-08-14')
  })

  // A bar labelled oddly still carries its spend; a throw from `toISOString` would take down the
  // whole report, which is the one outcome worse than a wrong label.
  it('falls back to the front of a stamp it cannot read at all', () => {
    expect(dayOf('not-a-date')).toBe('not-a-date')
    // Longer than a day, so the fallback is visibly a slice rather than the whole string.
    expect(dayOf('nonsense-that-runs-on')).toBe('nonsense-t')
    expect(dayOf('')).toBe('')
  })
})

describe('the usage route', () => {
  it('answers to its own hash, with or without the hash mark', () => {
    expect(isUsageRoute(`#${USAGE_ROUTE}`)).toBe(true)
    expect(isUsageRoute(USAGE_ROUTE)).toBe(true)
  })

  it('answers to nothing else', () => {
    expect(isUsageRoute('#settings')).toBe(false)
    expect(isUsageRoute('')).toBe(false)
  })
})
