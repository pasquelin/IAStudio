import { describe, expect, it } from 'vitest'
import { clipLane, embeddedClip, type ClipRef } from '@shared/domain/scene'
import { SECOND, type Us } from '@shared/domain/time'
import {
  clipBlendAt,
  clipSpanOf,
  clipsDuplicated,
  clipsMoved,
  clipsSplit,
  clipsTrimmed,
  clipTimeAt,
  lanesMinus,
  lanesMoved,
  lanesPlus,
  lanesWith,
  type ClipWeight,
} from './clipBlend'

const ref = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('block-1', 'Walk', extra)

/** Two seconds of walk cycle. */
const DURATION = 2

describe('where inside a clip the head stands', () => {
  it('is the start of the clip while the head is before the block, however far before', () => {
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

  /** One lane holding these blocks — what most of these cases are about. */
  const blendAt = (
    clips: readonly ClipRef[],
    heard: Readonly<Record<string, number>>,
    playhead: Us,
  ): ClipWeight[] => clipBlendAt([clipLane('main', clips)], heard, playhead)

  it('plays nothing for a model whose file has not landed', () => {
    expect(blendAt([walk()], {}, 0)).toEqual([])
  })

  it('plays the block the head is inside, and it alone', () => {
    expect(blendAt([walk(), dance({ start: 4 * SECOND })], lengths, SECOND)).toEqual([
      { clipId: 'walk', name: 'Walk', time: 1, weight: 1 },
    ])
    expect(blendAt([walk(), dance({ start: 2 * SECOND })], lengths, 3 * SECOND)).toEqual([
      { clipId: 'dance', name: 'Dance', time: 1, weight: 1 },
    ])
  })

  it('holds the last frame of the block behind it while nothing covers the head', () => {
    // Between a walk ending at two seconds and a dance starting at five.
    const blend = blendAt(
      [walk({ loop: false }), dance({ start: 5 * SECOND })],
      lengths,
      3 * SECOND,
    )

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 2, weight: 1 }])
  })

  it('holds the first frame of the first block while the head is before them all', () => {
    const blend = blendAt([walk({ start: 4 * SECOND })], lengths, 1 * SECOND)

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 0, weight: 1 }])
  })

  it('blends two overlapping blocks so their weights add up to exactly one', () => {
    const blend = blendAt(
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

  // What a fade must never look like: a character melting towards its bind pose. With nothing to
  // cross into, a lone fade has nothing to do — the block simply holds.
  it('never fades towards the rest pose when a block has no neighbour to cross into', () => {
    const blend = blendAt([walk({ duration: 4 * SECOND, fadeIn: 2 * SECOND })], lengths, SECOND)

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 1, weight: 1 }])
  })

  it('never lets the weights fall short of one pose at the junction of two blocks', () => {
    // Laid end to end with fades that do not overlap: the sum used to drop to nothing here, and
    // the character flashed through its bind pose.
    const blend = blendAt(
      [
        walk({ duration: 2 * SECOND, fadeOut: SECOND }),
        dance({ start: 2 * SECOND, duration: 2 * SECOND, fadeIn: SECOND }),
      ],
      lengths,
      1.9 * SECOND,
    )

    expect(blend.reduce((sum, entry) => sum + entry.weight, 0)).toBe(1)
  })

  it('never lets two blocks laid end to end both answer for the instant they share', () => {
    const blend = blendAt([walk(), dance({ start: 2 * SECOND })], lengths, 2 * SECOND)

    expect(blend.map(entry => entry.clipId)).toEqual(['dance'])
  })

  it('plays a block of every lane at once, which is what stacking them is for', () => {
    const blend = clipBlendAt(
      [clipLane('a', [walk()]), clipLane('b', [dance()])],
      lengths,
      1 * SECOND,
    )

    expect(blend.map(entry => entry.clipId).sort()).toEqual(['dance', 'walk'])
  })

  // Two whole-body moves layered give their average, and saying so is the honest answer until a
  // body mask lets the upper lane drive a few bones only.
  it('shares the pose evenly between the lanes that sound', () => {
    const blend = clipBlendAt(
      [clipLane('a', [walk()]), clipLane('b', [dance()])],
      lengths,
      1 * SECOND,
    )

    expect(blend.map(entry => entry.weight)).toEqual([0.5, 0.5])
  })

  it('lets an empty lane take nothing from the one that plays', () => {
    const blend = clipBlendAt([clipLane('a', [walk()]), clipLane('b')], lengths, 1 * SECOND)

    expect(blend).toEqual([{ clipId: 'walk', name: 'Walk', time: 1, weight: 1 }])
  })

  // Each lane holds its own edge pose. Read across the lanes instead, a block of one would have
  // held for the whole band and drowned out what the other was playing.
  it('holds inside its own lane and nowhere else', () => {
    const blend = clipBlendAt(
      [clipLane('a', [walk({ loop: false })]), clipLane('b', [dance({ start: 6 * SECOND })])],
      lengths,
      3 * SECOND,
    )

    expect(blend.map(entry => entry.clipId).sort()).toEqual(['dance', 'walk'])
  })
})

describe('editing the blocks of a lane', () => {
  const walk = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('walk', 'Walk', extra)
  const lanes = [clipLane('a', [walk({ duration: 2 * SECOND })]), clipLane('b')]

  it('rewrites the named lane and leaves the others as they stood', () => {
    const next = lanesWith(lanes, 'a', clips => clipsMoved(clips, 'walk', SECOND))

    expect(next?.[0]?.clips[0]?.start).toBe(SECOND)
    expect(next?.[1]).toBe(lanes[1])
  })

  it('refuses an edit naming a lane that is not there', () => {
    expect(lanesWith(lanes, 'nowhere', clips => clips)).toBeNull()
  })

  // Snapped to the frame, a drag lands on the width it already has three times out of four: an
  // entry banked for each would be an undo doing nothing the eye can see.
  it('refuses a move and a trim that change nothing', () => {
    expect(clipsMoved([walk({ start: SECOND })], 'walk', SECOND)).toBeNull()
    expect(clipsTrimmed([walk({ duration: 2 * SECOND })], 'walk', 'out', 2 * SECOND, 2)).toBeNull()
  })

  it('adds a lane at the end of the stack', () => {
    expect(lanesPlus(lanes, 'fresh').map(lane => lane.id)).toEqual(['a', 'b', 'fresh'])
  })

  // An object's track is where an animation is dropped: one with no lane left has nowhere to
  // receive the next.
  it('never takes the last lane away', () => {
    expect(lanesMinus(lanes, 'b')?.map(lane => lane.id)).toEqual(['a'])
    expect(lanesMinus([clipLane('a')], 'a')).toBeNull()
  })

  it('moves a lane through the stack, and stops at its ends rather than wrapping', () => {
    expect(lanesMoved(lanes, 'a', 1)?.map(lane => lane.id)).toEqual(['b', 'a'])
    expect(lanesMoved(lanes, 'a', -1)).toBeNull()
    expect(lanesMoved(lanes, 'b', 9)).toBeNull()
  })

  it('takes a fade down with the edge that swallowed it', () => {
    const trimmed = clipsTrimmed(
      [walk({ duration: 2 * SECOND, fadeOut: SECOND })],
      'walk',
      'out',
      0.4 * SECOND,
      2,
    )

    expect(trimmed?.[0]?.fadeOut).toBe(0.4 * SECOND)
  })

  it('lays a copy end to end with the block it came from', () => {
    const copied = clipsDuplicated([walk({ start: SECOND, duration: 2 * SECOND })], 'walk', 'x', 2)

    expect(copied?.map(clip => [clip.id, clip.start])).toEqual([
      ['walk', SECOND],
      ['x', 3 * SECOND],
    ])
  })

  // The width of a block whose file has not landed is the file's own, and there is none yet: the
  // copy would be laid on top of its original.
  it('refuses to copy a block that has no width yet', () => {
    expect(clipsDuplicated([walk()], 'walk', 'x', null)).toBeNull()
  })

  it('cuts a block in two, the tail playing on from where the head stops', () => {
    const cut = clipsSplit([walk({ duration: 2 * SECOND })], 'walk', 0.5 * SECOND, 'tail', 2)

    expect(cut?.map(clip => [clip.id, clip.start, clip.duration, clip.offset])).toEqual([
      ['walk', 0, 0.5 * SECOND, 0],
      ['tail', 0.5 * SECOND, 1.5 * SECOND, 0.5],
    ])
  })

  // A cut is a butt joint: a ramp there would dip the pose in the middle of one move.
  it('leaves no fade on either side of the cut', () => {
    const cut = clipsSplit(
      [walk({ duration: 2 * SECOND, fadeIn: 0.2 * SECOND, fadeOut: 0.2 * SECOND })],
      'walk',
      SECOND,
      'tail',
      2,
    )

    expect(cut?.map(clip => [clip.fadeIn, clip.fadeOut])).toEqual([
      [0.2 * SECOND, 0],
      [0, 0.2 * SECOND],
    ])
  })

  it('refuses a cut on an edge of the block, which would give a half of no width', () => {
    const block = [walk({ duration: 2 * SECOND })]

    expect(clipsSplit(block, 'walk', 0, 'tail', 2)).toBeNull()
    expect(clipsSplit(block, 'walk', 2 * SECOND, 'tail', 2)).toBeNull()
  })

  // A looping block played past the end of its clip comes round again, so the tail has to read
  // where the head actually stood rather than off the end of the file.
  it('wraps the tail of a looping block into the clip it plays', () => {
    const cut = clipsSplit([walk({ duration: 5 * SECOND, loop: true })], 'walk', 3 * SECOND, 't', 2)

    expect(cut?.[1]?.offset).toBe(1)
  })
})
