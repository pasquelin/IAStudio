import { describe, expect, it } from 'vitest'
import { formatMoment } from '@/helpers/format'
import { formatDay, formatMoney, formatUnits, shareOf } from './format'

describe('formatUnits', () => {
  it('groups thousands without pretending to a precision nobody spends', () => {
    expect(formatUnits(1240, 'fr-FR')).toMatch(/1\s?240/)
  })

  // Rounding a cheap call to zero would read as "this was free".
  it('keeps decimals for the small amounts a single call costs', () => {
    expect(formatUnits(0.25, 'en-US')).toBe('0.25')
  })

  it('writes a true zero as zero', () => {
    expect(formatUnits(0, 'en-US')).toBe('0')
  })
})

describe('formatMoney', () => {
  it('follows the locale, not the currency', () => {
    expect(formatMoney(12.4, 'EUR', 'en-US')).toBe('€12.40')
  })
})

describe('formatDay', () => {
  // Read as UTC: the API dates its points there, and a local reading shifts a day at each end.
  it('reads an ISO day without shifting it into the local zone', () => {
    expect(formatDay('2026-08-01', 'en-US')).toBe('Aug 1')
  })

  it('hands back anything it cannot parse rather than showing "Invalid Date"', () => {
    expect(formatDay('not-a-date', 'en-US')).toBe('not-a-date')
  })

  /**
   * The PAIR, which nothing held and which is the defect this case was written for.
   *
   * This window shows the same events twice: as bars grouped by day, and as rows of the journal.
   * The bar's day comes from `dayOf` in the main process — the first ten characters of the ISO
   * stamp, so UTC — while the row used to be drawn in whatever zone the machine ran in. Measured
   * in `Europe/Paris`, an event at 23:30 UTC sat on the bar of the 13th and printed `14/08 01:30`
   * two panes away, with nothing on screen accounting for the gap.
   *
   * `dayOf` is not imported: it lives in `main/`, and the renderer cannot reach across that
   * boundary. Its rule is restated here as `slice(0, 10)`, which is all it is — and the assertion
   * is that the two functions the WINDOW owns agree on the day.
   */
  it('names the same day as the journal row beside it', () => {
    const lateEvening = '2026-08-13T23:30:00Z'

    expect(formatDay(lateEvening.slice(0, 10), 'en-US')).toBe('Aug 13')
    expect(formatMoment(lateEvening, 'en-US', 'utc')).toMatch(/^8\/13\/26/)
  })
})

describe('shareOf', () => {
  it('measures a row against the largest one', () => {
    expect(shareOf(25, 100)).toBe(25)
  })

  it('answers zero rather than dividing by nothing', () => {
    expect(shareOf(5, 0)).toBe(0)
  })
})
