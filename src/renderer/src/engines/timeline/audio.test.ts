import { describe, expect, it } from 'vitest'
import { audioChunksIn, fadeAt, type ClipFade } from './audio'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import type { Clip, SequenceState } from './timelineState'

const clip = (id: string, start: number, duration: number, inPoint = 0): Clip =>
  clipFixture(id, start, duration, { inPoint })

const withAudio = (clips: Clip[], muted = false): SequenceState =>
  sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio', clips, { muted })])

describe('audio scheduling', () => {
  it('plans nothing when the window holds no clip', () => {
    expect(audioChunksIn(withAudio([clip('a', 5_000_000, 1_000_000)]), 0, 1_000_000)).toEqual([])
  })

  it('plans a chunk for a clip inside the window', () => {
    const chunks = audioChunksIn(withAudio([clip('a', 1_000_000, 2_000_000)]), 0, 4_000_000)
    expect(chunks).toEqual([
      {
        trackId: 'A1',
        clipId: 'a',
        assetId: 'asset-a',
        at: 1_000_000,
        sourceStart: 0,
        duration: 2_000_000,
        speed: 1,
        gain: 0,
        fade: { from: 1_000_000, to: 3_000_000, risenAt: 1_000_000, fallsFrom: 3_000_000 },
      },
    ])
  })

  it('clips the chunk to the window and moves the source start with it', () => {
    const chunks = audioChunksIn(
      withAudio([clip('a', 0, 4_000_000, 500_000)]),
      1_000_000,
      2_000_000,
    )
    expect(chunks[0]).toMatchObject({
      at: 1_000_000,
      sourceStart: 1_500_000,
      duration: 1_000_000,
    })
  })

  it('skips a muted track, which is what a mute button has to mean', () => {
    expect(audioChunksIn(withAudio([clip('a', 0, 1_000_000)], true), 0, 2_000_000)).toEqual([])
  })

  it('ignores video tracks: the picture is not scheduled, it is painted', () => {
    const state = sequenceWith([trackFixture('V1', 'video', [clip('v', 0, 1)])])
    expect(audioChunksIn(state, 0, 2_000_000)).toEqual([])
  })

  // Both are the clip's own, and whoever plays the chunk has no other way of knowing them.
  it("carries the clip's rate and gain over to whoever plays it", () => {
    const loud = { ...clip('a', 0, 1_000_000), speed: 1.5, gain: -6 }
    expect(audioChunksIn(withAudio([loud]), 0, 1_000_000)[0]).toMatchObject({
      speed: 1.5,
      gain: -6,
    })
  })

  it('accounts for speed when mapping into the source', () => {
    const fast = { ...clip('a', 0, 2_000_000), speed: 2 }
    expect(audioChunksIn(withAudio([fast]), 1_000_000, 2_000_000)[0]?.sourceStart).toBe(2_000_000)
  })

  /**
   * The ramps belong to the clip, not to the slice: a window opening mid-fade must still say how
   * far up the ramp already is, and a length measured from the slice's own edge could not.
   */
  it("carries the clip's own fade edges, not the window's", () => {
    const faded = { ...clip('a', 1_000_000, 2_000_000), fadeIn: 500_000, fadeOut: 400_000 }
    const chunks = audioChunksIn(withAudio([faded]), 2_000_000, 4_000_000)

    expect(chunks[0]).toMatchObject({
      at: 2_000_000,
      fade: { from: 1_000_000, to: 3_000_000, risenAt: 1_500_000, fallsFrom: 2_600_000 },
    })
  })
})

describe('a clip envelope', () => {
  const fade = (over: Partial<ClipFade> = {}): ClipFade => ({
    from: 0,
    to: 4_000_000,
    risenAt: 1_000_000,
    fallsFrom: 3_000_000,
    ...over,
  })

  it('holds full level between the two ramps', () => {
    expect(fadeAt(fade(), 2_000_000)).toBe(1)
  })

  it('rises linearly, so pressing play mid-fade comes in mid-level', () => {
    expect(fadeAt(fade(), 500_000)).toBe(0.5)
  })

  it('falls linearly to silence at the clip end', () => {
    expect(fadeAt(fade(), 3_500_000)).toBe(0.5)
    expect(fadeAt(fade(), 4_000_000)).toBe(0)
  })

  // A clip with neither ramp is one plateau: the edges meet, and no division by zero is reached.
  it('stays at full level for a clip with no ramp at all', () => {
    const flat = fade({ risenAt: 0, fallsFrom: 4_000_000 })

    expect(fadeAt(flat, 0)).toBe(1)
    expect(fadeAt(flat, 4_000_000)).toBe(1)
  })

  /** Asked outside its own clip by a slice rounded to the microsecond — never a negative gain. */
  it('clamps to the unit range outside the clip', () => {
    expect(fadeAt(fade(), -1_000_000)).toBe(0)
    expect(fadeAt(fade(), 5_000_000)).toBe(0)
  })
})
