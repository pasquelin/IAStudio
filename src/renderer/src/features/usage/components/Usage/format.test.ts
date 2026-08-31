import { describe, expect, it } from 'vitest'
import { dayOf } from '@shared/domain/usage'
import { formatMoment } from '@/helpers/format'
import { formatDay, shareOf } from './format'

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
   * `dayOf` is IMPORTED rather than restated, and that is the point of the case. It sat in
   * `main/provider/` at first, out of the renderer's reach, so this test recopied its `slice(0, 10)`
   * — a copy that would keep passing the day the real rule started reading a local day. It moved to
   * `shared/domain/usage.ts`, which both sides already import, so the pair is now held against the
   * function the chart actually counts with.
   */
  it('names the same day as the journal row beside it', () => {
    const lateEvening = '2026-08-13T23:30:00Z'

    expect(formatDay(dayOf(lateEvening), 'en-US')).toBe('Aug 13')
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
