import { describe, expect, it } from 'vitest'
import { DEFAULT_ANIMATION, type AnimationRef } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { clipTimeAt } from './animation'

const ref = (extra: Partial<AnimationRef> = {}): AnimationRef => ({
  ...DEFAULT_ANIMATION,
  clip: 'Walk',
  ...extra,
})

/** Two seconds of walk cycle. */
const DURATION = 2

describe('where inside a clip the head stands', () => {
  it('is the start of the clip while the head is before the block', () => {
    expect(clipTimeAt(ref({ start: 3 * SECOND }), DURATION, 0)).toBe(0)
    expect(clipTimeAt(ref({ start: 3 * SECOND }), DURATION, 1 * SECOND)).toBe(0)
  })

  it('follows the head once it enters the block', () => {
    expect(clipTimeAt(ref({ start: 1 * SECOND }), DURATION, 2 * SECOND)).toBe(1)
  })

  it('starts at the block, not at the origin of the band', () => {
    // A block starting at four seconds is at ITS first frame when the head reaches four.
    expect(clipTimeAt(ref({ start: 4 * SECOND }), DURATION, 4 * SECOND)).toBe(0)
  })

  it('wraps a looping clip rather than running off its end', () => {
    expect(clipTimeAt(ref({ loop: true }), DURATION, 5 * SECOND)).toBe(1)
  })

  it('holds the last frame of a clip that does not loop', () => {
    expect(clipTimeAt(ref({ loop: false }), DURATION, 9 * SECOND)).toBe(DURATION)
  })

  it('runs faster or slower with the speed, since it is a multiplier', () => {
    expect(clipTimeAt(ref({ speed: 2, loop: false }), 10, 1 * SECOND)).toBe(2)
    expect(clipTimeAt(ref({ speed: 0.5, loop: false }), 10, 2 * SECOND)).toBe(1)
  })

  it('answers the start for a clip with no length rather than dividing by nothing', () => {
    expect(clipTimeAt(ref(), 0, 5 * SECOND)).toBe(0)
    expect(Number.isNaN(clipTimeAt(ref(), 0, 5 * SECOND))).toBe(false)
  })

  it('never runs backwards, however far behind the block the head is', () => {
    expect(clipTimeAt(ref({ start: 10 * SECOND }), DURATION, 0)).toBe(0)
  })
})
