import { describe, expect, it } from 'vitest'
import { embeddedClip, type ClipRef } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { clipBlendAt, clipSpanOf, clipTimeAt } from './clipBlend'

const ref = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('block-1', 'Walk', extra)

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

  it('bites into the clip where the offset says, from the first frame of the block', () => {
    expect(clipTimeAt(ref({ offset: 0.5 }), DURATION, 0)).toBe(0.5)
    expect(clipTimeAt(ref({ offset: 0.5, start: SECOND }), DURATION, 2 * SECOND)).toBe(1.5)
  })
})

describe('how much band a block takes', () => {
  it('is the width the document holds, once anything has written one', () => {
    expect(clipSpanOf(ref({ duration: 7 * SECOND, speed: 2 }), DURATION)).toBe(7 * SECOND)
  })

  it('is otherwise the length of the clip at the speed it plays', () => {
    expect(clipSpanOf(ref(), DURATION)).toBe(2 * SECOND)
    expect(clipSpanOf(ref({ speed: 2 }), DURATION)).toBe(1 * SECOND)
  })

  it('is nothing at all while the file has not said how long the clip runs', () => {
    expect(clipSpanOf(ref(), null)).toBe(0)
  })
})

describe('what plays at a given head', () => {
  const lengths = { Walk: 2, Dance: 2 }

  const walk = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('walk', 'Walk', extra)
  const dance = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('dance', 'Dance', extra)

  it('plays nothing for a model whose file has not landed', () => {
    expect(clipBlendAt([walk()], {}, 0)).toEqual([])
  })

  it('plays the block the head is inside, and it alone', () => {
    const blend = clipBlendAt([walk(), dance({ start: 4 * SECOND })], lengths, 1 * SECOND)

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 1, weight: 1 }])
  })

  it('picks the second block once the head has reached it', () => {
    const blend = clipBlendAt([walk(), dance({ start: 2 * SECOND })], lengths, 3 * SECOND)

    expect(blend).toEqual([{ clipId: 'dance', name: 'Dance', time: 1, weight: 1 }])
  })

  it('holds the last frame of the block behind it while nothing covers the head', () => {
    // Between a walk ending at two seconds and a dance starting at five.
    const blend = clipBlendAt(
      [walk({ loop: false }), dance({ start: 5 * SECOND })],
      lengths,
      3 * SECOND,
    )

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 2, weight: 1 }])
  })

  it('holds the first frame of the first block while the head is before them all', () => {
    const blend = clipBlendAt([walk({ start: 4 * SECOND })], lengths, 1 * SECOND)

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 0, weight: 1 }])
  })

  it('blends two overlapping blocks so their weights add up to exactly one', () => {
    const blend = clipBlendAt(
      [
        walk({ duration: 4 * SECOND, fadeOut: 2 * SECOND }),
        dance({ start: 2 * SECOND, duration: 4 * SECOND, fadeIn: 2 * SECOND }),
      ],
      lengths,
      3 * SECOND,
    )

    expect(blend.map(entry => entry.clipId)).toEqual(['walk', 'dance'])
    expect(blend.map(entry => entry.weight)).toEqual([0.5, 0.5])
  })

  it('lets a lone block fade in from the rest pose rather than scaling it back to one', () => {
    const blend = clipBlendAt([walk({ duration: 4 * SECOND, fadeIn: 2 * SECOND })], lengths, SECOND)

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 1, weight: 0.5 }])
  })

  it('answers the same thing however the head got there', () => {
    const clips = [
      walk({ duration: 4 * SECOND, fadeOut: 2 * SECOND }),
      dance({ start: 2 * SECOND, duration: 4 * SECOND, fadeIn: 2 * SECOND }),
    ]

    // The whole point of taking the pose from the head alone: a scrub backwards, a render frame
    // by frame and playing forwards all land here.
    expect(clipBlendAt(clips, lengths, 2.5 * SECOND)).toEqual(
      clipBlendAt(clips, lengths, 2.5 * SECOND),
    )
  })

  it('never lets two blocks laid end to end both answer for the instant they share', () => {
    const blend = clipBlendAt([walk(), dance({ start: 2 * SECOND })], lengths, 2 * SECOND)

    expect(blend.map(entry => entry.clipId)).toEqual(['dance'])
  })
})
