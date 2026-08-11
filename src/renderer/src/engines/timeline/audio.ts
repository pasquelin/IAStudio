import { clipEnd, playsThrough, sourceTimeAt, type SequenceState, type Us } from './timeline-state'

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
      const start = Math.max(clip.start, from)
      const end = Math.min(clipEnd(clip), to)
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
      })
    }
  }

  return chunks
}
