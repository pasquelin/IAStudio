import { describe, expect, it, vi } from 'vitest'
import { cueFor, createSoundScheduler, type SoundCue, type SoundPort } from './sound-schedule'
import { audioChunksIn, type AudioChunk, type ClipFade } from './audio'
import { clipFixture, sequenceWith, settled, trackFixture } from './timeline-fixtures'
import type { Clip, SequenceState } from './timeline-state'

const chunk = (over: Partial<AudioChunk> = {}): AudioChunk => {
  // The default envelope follows the slice, so moving one in a case never leaves a fade behind it.
  const at = over.at ?? 0
  const duration = over.duration ?? 2_000_000

  return {
    trackId: 'A1',
    clipId: 'a',
    assetId: 'asset-a',
    at,
    sourceStart: 0,
    duration,
    speed: 1,
    gain: 0,
    fade: { from: at, to: at + duration, risenAt: at, fallsFrom: at + duration },
    ...over,
  }
}

/** A two-second slice at zero, ramped as asked. */
const ramped = (fade: Partial<ClipFade>, over: Partial<AudioChunk> = {}): AudioChunk =>
  chunk({ ...over, fade: { from: 0, to: 2_000_000, risenAt: 0, fallsFrom: 2_000_000, ...fade } })

const clip = (id: string, start: number, duration: number, extra: Partial<Clip> = {}): Clip =>
  clipFixture(id, start, duration, extra)

const withAudio = (clips: Clip[], extra = {}): SequenceState =>
  sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio', clips, extra)])

/** The output, as far as this suite is concerned: what it was asked to play, and when. */
const outputAt = (now = 0) => {
  const cues: SoundCue[] = []
  const stops = vi.fn()
  const port: SoundPort = {
    now: () => now,
    tap: () => null,
    resume: vi.fn(),
    load: vi.fn(async assetId => {
      loaded.push(assetId)
      return (cue: SoundCue) => {
        cues.push(cue)
        return { stop: stops }
      }
    }),
  }
  const loaded: string[] = []
  return { port, cues, loaded, stops }
}

describe('cueing one slice', () => {
  it('places a chunk on the output clock, the sequence anchored at the origin', () => {
    expect(cueFor(chunk({ at: 3_000_000, sourceStart: 500_000 }), 10, 10)).toEqual({
      when: 13,
      offset: 0.5,
      duration: 2,
      rate: 1,
      gain: 1,
      ramps: [],
    })
  })

  // Nothing to say: a clip with neither ramp holds one level from its first instant to its last.
  it('asks for no ramp at all when the clip has no fade', () => {
    expect(cueFor(chunk(), 0, 0)?.ramps).toEqual([])
  })

  it('comes in from silence and reaches full level where the rise ends', () => {
    const cue = cueFor(ramped({ risenAt: 500_000 }), 0, 0)

    expect(cue).toMatchObject({ gain: 0, ramps: [{ when: 0.5, level: 1 }] })
  })

  /**
   * The plateau is a corner too: without it the fall would start from the slice's first instant
   * and the clip would sink through its whole length instead of its last fraction.
   */
  it('holds full level up to the fall, then reaches silence at the end', () => {
    const cue = cueFor(ramped({ fallsFrom: 1_600_000 }), 0, 0)

    expect(cue).toMatchObject({
      gain: 1,
      ramps: [
        { when: 1.6, level: 1 },
        { when: 2, level: 0 },
      ],
    })
  })

  /**
   * A slice is planned before its sound is loaded, and a load that ran past half the fade-in must
   * come in half way up. A ramp length measured from the clip's edge could not say this.
   */
  it('enters part-way up when the load ate half the rise', () => {
    const cue = cueFor(ramped({ risenAt: 1_000_000 }), 0, 0.5)

    expect(cue).toMatchObject({ when: 0.5, gain: 0.5, ramps: [{ when: 1, level: 1 }] })
  })

  it("folds the clip's own gain into the envelope, so the output never scales twice", () => {
    const cue = cueFor(ramped({ risenAt: 500_000 }, { gain: -6 }), 0, 0)

    expect(cue?.ramps[0]?.level).toBeCloseTo(0.501_187, 6)
  })

  /**
   * The timeline and the output clock run 1:1; a rate only changes how fast the source is eaten
   * between two instants that stay where they are.
   */
  it('leaves the envelope where it is for a clip with a speed', () => {
    const cue = cueFor(ramped({ risenAt: 1_000_000 }, { speed: 2 }), 0, 0)

    expect(cue).toMatchObject({ duration: 4, ramps: [{ when: 1, level: 1 }] })
  })

  /**
   * The ordinary case, and the only one with three corners: the rise, the plateau the fall starts
   * from, and silence. Built from a real clip rather than a hand-made envelope, because that is
   * where the order comes from — `clampFades` holds a clip's rise before its fall on every path
   * that builds one, and `rampsFor` trusts it rather than sorting its own corners.
   */
  it('rises, holds, then falls for a clip faded at both ends', () => {
    const faded = clip('a', 0, 2_000_000, { fadeIn: 500_000, fadeOut: 500_000 })
    const planned = audioChunksIn(withAudio([faded]), 0, 2_000_000)[0]

    expect(planned && cueFor(planned, 0, 0)).toMatchObject({
      gain: 0,
      ramps: [
        { when: 0.5, level: 1 },
        { when: 1.5, level: 1 },
        { when: 2, level: 0 },
      ],
    })
  })

  // The window may end before the fall does, and the level it ends at is not silence.
  it('ends on the level the slice actually reaches when it stops mid-fall', () => {
    const cue = cueFor(ramped({ fallsFrom: 1_000_000 }, { duration: 1_500_000 }), 0, 0)

    expect(cue?.ramps).toEqual([
      { when: 1, level: 1 },
      { when: 1.5, level: 0.5 },
    ])
  })

  it('converts the decibels the clip carries, so the output never sees a decibel', () => {
    // −6 dB is half the amplitude, near enough for a comparison at six digits.
    expect(cueFor(chunk({ gain: -6 }), 0, 0)?.gain).toBeCloseTo(0.501_187, 6)
  })

  /**
   * A slice is planned before it is loaded, and a minute of music takes long enough to decode
   * to miss its own start. Playing the late part anyway holds the sound behind the picture for
   * the whole clip.
   */
  it('skips what a slow load already missed rather than playing it late', () => {
    const late = cueFor(chunk({ at: 0, duration: 2_000_000 }), 0, 0.5)

    expect(late).toMatchObject({ when: 0.5, offset: 0.5, duration: 1.5 })
  })

  it('reads the source faster than the timeline for a clip with a speed', () => {
    // Two seconds of timeline at double rate spends four seconds of source.
    expect(cueFor(chunk({ speed: 2 }), 0, 0)).toMatchObject({ duration: 4, rate: 2 })
  })

  it('skips into the source at the clip rate when the load was late', () => {
    const late = cueFor(chunk({ speed: 2, sourceStart: 1_000_000 }), 0, 0.5)

    // Half a second late at double rate is a whole second of source gone.
    expect(late).toMatchObject({ offset: 2, duration: 3 })
  })

  it('plays nothing at all for a slice that is entirely over', () => {
    expect(cueFor(chunk({ duration: 1_000_000 }), 0, 2)).toBeNull()
  })
})

describe('scheduling a sequence', () => {
  it('plays a clip under the playhead when the transport starts', async () => {
    const { port, cues } = outputAt(100)
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(1_000_000)
    await settled()

    // Started a second in: the source is read from a second in, for the three left.
    expect(cues).toEqual([{ when: 100, offset: 1, duration: 3, rate: 1, ramps: [], gain: 1 }])
  })

  it('wakes the output, which starts suspended until a gesture asks for sound', () => {
    const { port } = outputAt()
    createSoundScheduler({ port, horizon: 1_000_000 }).start(0)

    expect(port.resume).toHaveBeenCalled()
  })

  it('plans nothing before the transport starts', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.pump(0)
    await settled()

    expect(loaded).toEqual([])
  })

  it('leaves a clip beyond the horizon alone until the playhead nears it', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('far', 5_000_000, 1_000_000)]))

    scheduler.start(0)
    await settled()
    expect(loaded).toEqual([])

    scheduler.pump(4_500_000)
    await settled()
    expect(loaded).toEqual(['asset-far'])
  })

  /**
   * The horizon is a bound, not a hint: everything planned early is a sound decoded early and
   * held in memory until its turn, and a sequence is mostly clips whose turn has not come.
   */
  it('holds off a clip sitting exactly on the horizon until the playhead moves', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('edge', 1_000_000, 1_000_000)]))

    scheduler.start(0)
    await settled()
    expect(loaded).toEqual([])

    scheduler.pump(200_000)
    await settled()
    expect(loaded).toEqual(['asset-edge'])
  })

  /**
   * Planning window by window would cut every clip into slices the length of the horizon, and
   * a source restarted on each of them is heard as a click at every joint.
   */
  it('plans a clip whole, past the horizon it entered by', async () => {
    const { port, cues } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 30_000_000)]))

    scheduler.start(0)
    await settled()

    expect(cues[0]?.duration).toBe(30)
  })

  /**
   * Counted in cues rather than in loads: the samples are cached by asset, so a clip planned
   * twice loads once — and starts a second source over the first, which nothing can stop since
   * the map holds one entry per clip.
   */
  it('starts a clip once, however far the playhead travels across it', async () => {
    const { port, cues } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    // Well past the planning step, so it is the clip being known that stops the second start.
    scheduler.pump(1_000_000)
    scheduler.pump(2_000_000)
    await settled()

    expect(cues).toHaveLength(1)
  })

  /**
   * The sequence is read in steps, not per frame: with a second of horizon, building a chunk
   * for every audio clip sixty times a second is work the UI thread owes nobody.
   */
  it('leaves the sequence alone between two frames of the same step', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('edge', 1_100_000, 1_000_000)]))

    scheduler.start(0)
    // The clip is inside the horizon at this playhead, but the step has not elapsed.
    scheduler.pump(150_000)
    await settled()
    expect(loaded).toEqual([])

    scheduler.pump(200_000)
    await settled()
    expect(loaded).toEqual(['asset-edge'])
  })

  /**
   * The anchor is taken once. Re-taken on every pass, it would absorb the drift between the
   * output's clock and the engine's — which is the very thing it exists to expose.
   */
  it('keeps the anchor it first took, rather than following the engine clock', async () => {
    let clock = 50
    const { port, cues } = outputAt()
    const drifting: SoundPort = { ...port, now: () => clock }
    const scheduler = createSoundScheduler({ port: drifting, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('later', 1_500_000, 1_000_000)]))

    scheduler.start(0)
    // A second of timeline goes by, but the output ran a tenth of a second slow.
    clock = 50.9
    scheduler.pump(1_000_000)
    await settled()

    // Anchored at 50, the clip is due at 51.5 — not at 51.4, which re-anchoring would give.
    expect(cues[0]?.when).toBeCloseTo(51.5, 6)
  })

  /**
   * Muted and unmuted while the load was in flight, the clip holds a second entry. Started over
   * it, the first load plays the clip a second time — and only the newer entry can be stopped.
   */
  it('never lets a load started before a mute play over the entry that replaced it', async () => {
    const { port, cues } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    // A second track holds the same take — a doubled bed, and the reason the samples survive
    // the mute: without another holder the cache drops them and the stale load yields nothing.
    const bed = (muted: boolean): SequenceState =>
      sequenceWith([
        trackFixture('A1', 'audio', [clip('a', 0, 4_000_000)], { muted }),
        trackFixture('A2', 'audio', [{ ...clipFixture('b', 0, 4_000_000), assetId: 'asset-a' }], {
          index: 2,
        }),
      ])
    scheduler.apply(bed(false))

    scheduler.start(0)
    scheduler.apply(bed(true))
    scheduler.apply(bed(false))
    scheduler.pump(1_000_000)
    await settled()

    // One cue for the bed, one for the clip replanned after the unmute — never three.
    expect(cues).toHaveLength(2)
  })

  it('silences everything it has in flight when the transport stops', async () => {
    const { port, stops } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.stop()

    expect(stops).toHaveBeenCalledTimes(1)
  })

  /**
   * The load outlives the pause that revoked it. Left to arrive, it starts a sound over a
   * stopped transport — audible, and stoppable by nobody.
   */
  it('never starts a sound whose load lands after the stop', async () => {
    const { port, cues } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    scheduler.stop()
    await settled()

    expect(cues).toEqual([])
  })

  it('plays again from the new position after a stop', async () => {
    const { port, cues } = outputAt(100)
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.stop()
    scheduler.start(2_000_000)
    await settled()

    expect(cues[1]).toMatchObject({ offset: 2, duration: 2 })
  })

  it('silences a track muted while it was sounding, which is what the button means', async () => {
    const { port, stops } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)], { muted: true }))

    expect(stops).toHaveBeenCalledTimes(1)
  })

  it('plays a track again once it is unmuted, from where the playhead now is', async () => {
    const { port, cues } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    const clips = [clip('a', 0, 4_000_000)]
    scheduler.apply(withAudio(clips))

    scheduler.start(0)
    await settled()
    scheduler.apply(withAudio(clips, { muted: true }))
    scheduler.apply(withAudio(clips))
    scheduler.pump(1_000_000)
    await settled()

    expect(cues[1]).toMatchObject({ offset: 1, duration: 3 })
  })

  it('leaves a clip already sounding alone when an edit lands elsewhere', async () => {
    const { port, stops, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.apply(withAudio([clip('a', 0, 4_000_000), clip('b', 10_000_000, 1_000_000)]))
    await settled()

    expect(stops).not.toHaveBeenCalled()
    expect(loaded).toEqual(['asset-a'])
  })

  /**
   * A source was given the length of its clip and has run out on its own. Held in the map, its
   * samples stay in memory for the whole sequence — several megabytes a minute of music.
   */
  it('lets go of a clip that has finished, so its samples are not held to the end', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    // The same clip is asked for twice: it can only be planned again if it was let go of.
    scheduler.apply(withAudio([clip('a', 0, 1_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.pump(2_000_000)
    scheduler.pump(500_000)
    await settled()

    expect(loaded).toEqual(['asset-a', 'asset-a'])
  })

  it('says nothing over a gap between two clips', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 1_000_000), clip('b', 8_000_000, 1_000_000)]))

    scheduler.start(3_000_000)
    await settled()

    expect(loaded).toEqual([])
  })

  /**
   * A clip whose media moved is the ordinary case, not the exotic one. Retried, it fetches and
   * decodes on every frame it stays under the playhead — sixty times a second, for minutes.
   */
  it('remembers an asset the output could not read rather than retrying it', async () => {
    const { port } = outputAt()
    const failing: SoundPort = {
      ...port,
      load: vi.fn(() => Promise.reject(new Error('gone'))),
    }
    const scheduler = createSoundScheduler({ port: failing, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.pump(500_000)
    scheduler.pump(1_000_000)
    await settled()

    expect(failing.load).toHaveBeenCalledTimes(1)
  })

  /**
   * The other half of the same stutter: the load lands *after* the slice was due, so there is
   * nothing left to play. Dropped, the clip would be planned again on the very next frame.
   */
  it('gives up on a slice its load arrived too late for, without asking again', async () => {
    let now = 0
    const cues: SoundCue[] = []
    const port: SoundPort = {
      now: () => now,
      tap: () => null,
      resume: vi.fn(),
      // The load spends two seconds of output time — longer than the clip it was asked for.
      load: vi.fn(async () => {
        now += 2
        return (cue: SoundCue) => {
          cues.push(cue)
          return { stop: vi.fn() }
        }
      }),
    }
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('short', 0, 1_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.pump(500_000)
    await settled()

    expect(cues).toEqual([])
    expect(port.load).toHaveBeenCalledTimes(1)
  })

  /**
   * `decodeAudioData` decodes the file, not the clip's share of it. The same jingle laid thirty
   * times would be thirty full copies of the samples, resident at once where the clips overlap.
   */
  it('decodes an asset once for the several clips that play it', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    // Both clips name `asset-a`, as two clips cut from one take do.
    const second = { ...clipFixture('b', 0, 2_000_000), assetId: 'asset-a' }
    scheduler.apply(withAudio([clip('a', 0, 2_000_000), second]))

    scheduler.start(0)
    await settled()

    expect(loaded).toEqual(['asset-a'])
  })

  it('takes a clip away mid-play when the edit removed it, not only when it was muted', async () => {
    const { port, stops } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.apply(withAudio([]))

    expect(stops).toHaveBeenCalledTimes(1)
  })

  /**
   * The source runs out on the output clock, the playhead on the engine's. Let go of on the
   * beat, an entry whose source still sounds is a sound `stop` can no longer reach — and it
   * keeps playing over a paused transport.
   */
  it('keeps hold of a finished clip a horizon longer, so a pause can still silence it', async () => {
    const { port, stops } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 1_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.pump(1_200_000)
    scheduler.stop()

    expect(stops).toHaveBeenCalledTimes(1)
  })

  it('says nothing while the output is still waking up', async () => {
    const { port, loaded } = outputAt()
    const asleep: SoundPort = { ...port, now: () => null }
    const scheduler = createSoundScheduler({ port: asleep, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()

    expect(loaded).toEqual([])
  })

  /**
   * The anchor is the output clock's, and it is taken when the output answers — not when the
   * transport was pressed, which may be several frames earlier.
   */
  it('anchors the sequence on the output as soon as it answers, not before', async () => {
    let clock: number | null = null
    const { port, cues } = outputAt()
    const waking: SoundPort = { ...port, now: () => clock }
    const scheduler = createSoundScheduler({ port: waking, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    clock = 50
    scheduler.pump(500_000)
    await settled()

    // Anchored at 50 for a playhead of half a second: the clip's zero sits at 49.5, and what is
    // left of it starts now, half a second into the source.
    expect(cues[0]).toMatchObject({ when: 50, offset: 0.5, duration: 3.5 })
  })
})
