import { clipEnd, playsThrough, sourceTimeAt, type SequenceState, type Us } from './timeline-state'

/**
 * The clip's own ramps, as timeline instants rather than lengths.
 *
 * Instants because a slice is resolved against a window and may begin **inside** a fade: pressing
 * play halfway through a fade-in must come in at half level, and a length alone says nothing
 * about how much of the ramp is already past.
 */
export type ClipFade = {
  /** The clip's own edges — the ramps are measured from these, never from the slice's. */
  from: Us
  to: Us
  /** Where the rise finishes and the fall begins. Equal to `from` / `to` when there is no ramp. */
  risenAt: Us
  fallsFrom: Us
}

/**
 * The clip's envelope at one timeline instant, as a factor between 0 and 1.
 *
 * Linear, like `applyFades` in `engines/audio/audio-data.ts` and like the triangle the painter
 * draws: this is one take fading to silence, not two takes crossing. A shape the ear does not
 * hear where the eye sees it would make the drawing a lie.
 */
export function fadeAt(fade: ClipFade, at: Us): number {
  if (at < fade.risenAt) return clampFactor((at - fade.from) / (fade.risenAt - fade.from))
  if (at > fade.fallsFrom) return clampFactor((fade.to - at) / (fade.to - fade.fallsFrom))
  return 1
}

function clampFactor(factor: number): number {
  return Math.max(0, Math.min(1, factor))
}

/** A slice of one clip's audio to be scheduled, already resolved against the window. */
export type AudioChunk = {
  trackId: string
  clipId: string
  assetId: string
  /** Position on the timeline where this slice starts. */
  at: Us
  /** Where to read from inside the source. */
  sourceStart: Us
  /** On the timeline. The source is read `speed` times faster, so it spends `duration × speed`. */
  duration: Us
  /** How much faster than the timeline the source is read — a clip's own rate. */
  speed: number
  /** Decibels, as the clip carries them. Zero leaves the take as it was recorded. */
  gain: number
  /** The whole clip's ramps, not the slice's: a slice may begin inside a fade. */
  fade: ClipFade
}

/**
 * What has to sound between two instants. Pure, so the scheduling rules are testable without
 * an `AudioContext` — jsdom has none, and the arithmetic is where the bugs are.
 */
export function audioChunksIn(state: SequenceState, from: Us, to: Us): AudioChunk[] {
  const chunks: AudioChunk[] = []

  for (const track of state.tracks) {
    if (track.kind !== 'audio' || !playsThrough(state, track)) continue

    for (const clip of track.clips) {
      const finish = clipEnd(clip)
      const start = Math.max(clip.start, from)
      const end = Math.min(finish, to)
      if (end <= start) continue

      chunks.push({
        trackId: track.id,
        clipId: clip.id,
        assetId: clip.assetId,
        at: start,
        sourceStart: sourceTimeAt(clip, start),
        duration: end - start,
        speed: clip.speed,
        gain: clip.gain,
        fade: {
          from: clip.start,
          to: finish,
          risenAt: clip.start + clip.fadeIn,
          fallsFrom: finish - clip.fadeOut,
        },
      })
    }
  }

  return chunks
}
