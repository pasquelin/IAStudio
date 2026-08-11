import { describe, expect, it, vi } from 'vitest'
import { cueFor, createSoundScheduler, type SoundCue, type SoundPort } from './sound-schedule'
import type { AudioChunk } from './audio'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import type { Clip, SequenceState } from './timeline-state'

const chunk = (over: Partial<AudioChunk> = {}): AudioChunk => ({
  trackId: 'A1',
  clipId: 'a',
  assetId: 'asset-a',
  at: 0,
  sourceStart: 0,
  duration: 2_000_000,
  speed: 1,
  gain: 0,
  ...over,
})

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

/** Loading is asynchronous, and a rejection takes more turns of the queue than a value. */
const settled = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

describe('cueing one slice', () => {
  it('places a chunk on the output clock, the sequence anchored at the origin', () => {
    expect(cueFor(chunk({ at: 3_000_000, sourceStart: 500_000 }), 10, 10)).toEqual({
      when: 13,
      offset: 0.5,
      duration: 2,
      rate: 1,
      gain: 1,
    })
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
    expect(cues).toEqual([{ when: 100, offset: 1, duration: 3, rate: 1, gain: 1 }])
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

    scheduler.pump(1)
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

  it('plans a clip once, however many frames pass over it', async () => {
    const { port, loaded } = outputAt()
    const scheduler = createSoundScheduler({ port, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.pump(16_000)
    scheduler.pump(32_000)
    await settled()

    expect(loaded).toEqual(['asset-a'])
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

  it('survives a load that fails, and plans the clip again on a later pass', async () => {
    const { port } = outputAt()
    const failing: SoundPort = {
      ...port,
      load: vi.fn(async () => Promise.reject(new Error('gone'))),
    }
    const scheduler = createSoundScheduler({ port: failing, horizon: 1_000_000 })
    scheduler.apply(withAudio([clip('a', 0, 4_000_000)]))

    scheduler.start(0)
    await settled()
    scheduler.pump(16_000)
    await settled()

    expect(failing.load).toHaveBeenCalledTimes(2)
  })
})
