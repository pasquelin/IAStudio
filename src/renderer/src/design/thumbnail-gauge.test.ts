import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from './testHarness'

/**
 * A `<Thumbnail>` sized in Tailwind's numeric scale — `size-8`, `size-10`.
 *
 * Those are PIXELS: `size-8` is 32px at both densities, so it is right at one and wrong at the
 * other, and five sites had reached for one of them independently. The studio has two gauges for
 * a row's picture and no third — `FIELD_THUMBNAIL` for a line carrying one word, `ROW_THUMBNAIL`
 * for a line carrying a name and a line under it.
 *
 * Only the numeric scale is refused: `size-(--sc-…)` and `size-full` are gauges.
 */
const PIXEL_SIZED_THUMBNAIL = /<Thumbnail[^>]*?\bsize-\d/s

describe('the picture of a row', () => {
  it('finds the sources at all, so the rule below cannot pass on an empty list', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
  })

  /**
   * 🛑 Two blind spots, written rather than hidden: this reads the TAG, so a class handed over
   * through a constant or a prop is invisible here; and `[^>]` stops at the first `>`, so an
   * arrow in an earlier attribute hides whatever follows it. What it does catch is the way all
   * five offenders were written — a literal on the tag itself. Checked by breaking it.
   */
  it('is never sized in pixels', () => {
    const offenders = WRITTEN_SOURCES.filter(([, source]) =>
      PIXEL_SIZED_THUMBNAIL.test(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
