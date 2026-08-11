import { fromDb } from '../audio/audio-data'
import { audioChunksIn, type AudioChunk } from './audio'
import {
  EMPTY_SEQUENCE,
  playsThrough,
  sequenceDuration,
  type SequenceState,
  type Us,
} from './timeline-state'

/** What one planned slice asks of the output, in the output's own seconds. */
export type SoundCue = {
  /** On the output clock, not on the timeline. */
  when: number
  /** Where to start reading inside the source. */
  offset: number
  /** How much source to read — it lasts that divided by `rate`. */
  duration: number
  rate: number
  /** Linear amplitude: the decibels are converted here, never at the output. */
  gain: number
}

export type PlayingSound = { stop: () => void }

/** A sound in memory, ready to be started. */
export type LoadedSound = (cue: SoundCue) => PlayingSound

/**
 * What the window can do and jsdom cannot: read over the scheme, decode samples, put them on an
 * output clock. Everything above this line is arithmetic, and the arithmetic is where the bugs
 * are — a sound planned a frame late is heard, a picture painted a frame late is not.
 */
export type SoundPort = {
  /** Seconds on the output's own clock. */
  now: () => number
  /** An output built before any gesture starts suspended, and every cue lands in silence. */
  resume: () => void
  load: (assetId: string) => Promise<LoadedSound>
}

/**
 * Where a chunk lands on the output clock, or nothing when it is already over.
 *
 * A slice is planned before its sound is loaded, and decoding a minute of music takes long
 * enough to miss its own start. What is late is *skipped* rather than played late: playing it
 * late would hold the sound behind the picture for the whole clip, and a lip sync off by a
 * tenth of a second is the one thing an editor hears immediately.
 */
export function cueFor(chunk: AudioChunk, origin: number, now: number): SoundCue | null {
  const due = origin + chunk.at / 1_000_000
  const late = Math.max(0, now - due)
  // Both in source seconds: a clip at twice the rate spends two seconds of source per second.
  const offset = chunk.sourceStart / 1_000_000 + late * chunk.speed
  const duration = (chunk.duration / 1_000_000 - late) * chunk.speed

  if (duration <= 0) return null
  return { when: due + late, offset, duration, rate: chunk.speed, gain: fromDb(chunk.gain) }
}

/**
 * How far ahead a clip is planned. It is the time a load has to fetch and decode before its own
 * start, and the amount of sound that has to be silenced when the transport stops — a second
 * covers a take of music on a warm disk without holding the whole sequence in memory.
 */
export const SOUND_HORIZON: Us = 1_000_000

export type SoundSchedulerDeps = {
  port: SoundPort
  /** How far ahead of the playhead a clip is planned — the time a load has to arrive. */
  horizon: Us
}

export type SoundScheduler = {
  apply: (state: SequenceState) => void
  /** Anchors the timeline on the output clock, then plans what is already due. */
  start: (time: Us) => void
  /** Plans whatever entered the horizon and forgets what has finished. */
  pump: (time: Us) => void
  stop: () => void
}

/** A clip in flight: the track it answers to, where it ends, and what silences it. */
type Scheduled = { trackId: string; until: Us; stop: () => void }

/**
 * Plays what the sequence says, one source per clip.
 *
 * A clip is planned **whole**, once, as it enters the horizon — not sliced window by window.
 * That is what keeps a sound loaded no longer than the clip that needs it: this pool holds no
 * cache of its own, where the picture needs two of them (`decoder-pool`, `image-cache`), and a
 * take of music decoded stereo costs several megabytes a minute.
 *
 * The cost of it is a clip playing twice from the same asset loading it twice.
 */
export function createSoundScheduler({ port, horizon }: SoundSchedulerDeps): SoundScheduler {
  let state: SequenceState = EMPTY_SEQUENCE
  /** The output time the sequence's zero sits at, or null while nothing plays. */
  let origin: number | null = null
  const playing = new Map<string, Scheduled>()

  const schedule = (chunk: AudioChunk, anchor: number): void => {
    const entry: Scheduled = {
      trackId: chunk.trackId,
      until: chunk.at + chunk.duration,
      stop: () => {},
    }
    playing.set(chunk.clipId, entry)

    const forget = (): void => {
      if (playing.get(chunk.clipId) === entry) playing.delete(chunk.clipId)
    }

    void port.load(chunk.assetId).then(sound => {
      // This entry, not this clip. A stop drops it, and a track muted then unmuted while the
      // load was in flight holds a *second* entry under the same clip — starting this one over
      // it would play the clip twice, with only the newer one stoppable.
      if (playing.get(chunk.clipId) !== entry) return

      const cue = cueFor(chunk, anchor, port.now())
      if (!cue) return forget()
      entry.stop = sound(cue).stop
    }, forget)
  }

  const pump = (time: Us): void => {
    if (origin === null) return
    const anchor = origin

    // Not stopped, only let go of: a source was given the length of its clip and has run out on
    // its own. Holding the entry would hold the samples behind it for the whole sequence.
    for (const [clipId, entry] of playing) if (entry.until <= time) playing.delete(clipId)

    const horizonEnd = time + horizon
    // Asked to the end of the sequence rather than to the horizon: the horizon says which clips
    // to plan, the clip itself says how long it sounds, and a window would cut it short.
    for (const chunk of audioChunksIn(state, time, sequenceDuration(state))) {
      if (chunk.at < horizonEnd && !playing.has(chunk.clipId)) schedule(chunk, anchor)
    }
  }

  return {
    apply: next => {
      state = next
      // Muting has to be heard at once — that is what the button means. The rest of an edit
      // reaches only what is planned after it, as in any editor: a clip already sounding out is
      // not re-cut under the playhead.
      for (const [clipId, entry] of playing) {
        const track = next.tracks.find(candidate => candidate.id === entry.trackId)
        if (track && playsThrough(next, track)) continue
        entry.stop()
        playing.delete(clipId)
      }
    },

    start: time => {
      port.resume()
      origin = port.now() - time / 1_000_000
      pump(time)
    },

    pump,

    stop: () => {
      for (const entry of playing.values()) entry.stop()
      playing.clear()
      origin = null
    },
  }
}
