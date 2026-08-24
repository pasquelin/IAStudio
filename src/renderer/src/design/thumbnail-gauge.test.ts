import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from './testHarness'

/**
 * A `<Thumbnail>` sized in Tailwind's numeric scale — `size-8`, `size-10`.
 *
 * Those are PIXELS: `size-8` is 32px at both densities, so it is right at one and wrong at the
 * other, and five sites had reached for one of them independently.
 *
 * Only the numeric scale is refused: `size-(--sc-…)` and `size-full` are gauges.
 */
const PIXEL_SIZED_THUMBNAIL = /<Thumbnail[^>]*?\bsize-\d/s

/**
 * A `<Thumbnail>` sized by whoever mounts it, anywhere but a property field.
 *
 * `FIELD_THUMBNAIL` is the one gauge left and it answers for a FIELD alone. A row's picture is
 * sized by `Row`, from `--sc-row-pad` and the shape of the line — which is what replaced four
 * sizes and four paddings, one per caller.
 */
const CALLER_SIZED_THUMBNAIL = /<Thumbnail[^>]*?\bclassName=\{(?!FIELD_THUMBNAIL\})/s

const offenders = (rule: RegExp) =>
  WRITTEN_SOURCES.filter(([, source]) => rule.test(source)).map(([path]) => path)

describe('the picture of a row', () => {
  it('finds the sources at all, so the rules below cannot pass on an empty list', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
  })

  /**
   * 🛑 Two blind spots, written rather than hidden: these read the TAG, so a class handed over
   * through a prop is invisible here; and `[^>]` stops at the first `>`, so an arrow in an
   * earlier attribute hides whatever follows it. What they catch is the way every offender was
   * written — a literal on the tag itself. Checked by breaking them.
   *
   * A third: `EntryRow` draws its preview with `LoadableImage`, not `Thumbnail`, so no rule here
   * sees it. It is `Row`'s box that holds it to the studio's one size.
   */
  it('is never sized in pixels', () => {
    expect(offenders(PIXEL_SIZED_THUMBNAIL)).toEqual([])
  })

  it('is never sized by whoever mounts the row', () => {
    expect(offenders(CALLER_SIZED_THUMBNAIL)).toEqual([])
  })
})
