import { STT_SAMPLE_RATE } from '@shared/domain/dictation'

/**
 * The audio the worker holds while the engine is busy, and the rule for when to let go of it.
 *
 * Separated from the worker so it can be tested: everything below is arithmetic over sample
 * counts, and the worker around it is wiring to a native addon no test can load.
 */

/**
 * How much speech is kept at most. Thirty seconds is longer than any sentence and shorter than
 * a monologue; past it the oldest audio is dropped, because a queue that only grows turns a
 * slow machine into one that transcribes yesterday.
 */
export const MAX_HELD_SECONDS = 30

const MAX_HELD_SAMPLES = MAX_HELD_SECONDS * STT_SAMPLE_RATE

/**
 * Speech starts before the detector is sure of it — Silero needs a few frames to decide. What
 * is kept from before that moment, so a preview does not open mid-word.
 *
 * The settled text never depends on this: it comes from the segment the detector itself closes,
 * which carries its own beginning.
 */
export const PREROLL_SECONDS = 0.5

const PREROLL_SAMPLES = Math.round(PREROLL_SECONDS * STT_SAMPLE_RATE)

/** Accumulates chunks, bounded, and reports what it had to drop. */
export type Held = {
  chunks: Float32Array[]
  length: number
  /** Samples thrown away since the last reset, for the log. */
  dropped: number
}

export function emptyHeld(): Held {
  return { chunks: [], length: 0, dropped: 0 }
}

/**
 * Adds a chunk, dropping whole chunks from the front once the bound is passed.
 *
 * Whole chunks rather than exact sample counts: the boundary lands within 100 ms of the limit,
 * and slicing a Float32Array to be precise would allocate on every push for no audible gain.
 */
export function hold(held: Held, chunk: Float32Array): Held {
  const chunks = [...held.chunks, chunk]
  let length = held.length + chunk.length
  let dropped = held.dropped

  while (length > MAX_HELD_SAMPLES && chunks.length > 1) {
    const oldest = chunks.shift()
    if (!oldest) break
    length -= oldest.length
    dropped += oldest.length
  }

  return { chunks, length, dropped }
}

/** Everything held, as one buffer the engine can take. */
export function flatten(held: Held): Float32Array {
  const all = new Float32Array(held.length)
  let at = 0

  for (const chunk of held.chunks) {
    all.set(chunk, at)
    at += chunk.length
  }

  return all
}

/**
 * What a preview should decode: the tail of what is held, from a little before speech was
 * detected. Everything older belongs to sentences already settled.
 */
export function previewOf(held: Held, spokenSamples: number): Float32Array {
  const wanted = Math.min(held.length, spokenSamples + PREROLL_SAMPLES)
  const all = flatten(held)
  return all.subarray(all.length - wanted)
}

/** 16-bit samples back to the [-1, 1] floats the engine reads. */
export function toFloat(samples: Int16Array): Float32Array {
  const floats = new Float32Array(samples.length)
  for (let index = 0; index < samples.length; index += 1) {
    // 32768 rather than 32767: it is the magnitude of the most negative sample, so -32768 maps
    // to exactly -1 and nothing overshoots.
    floats[index] = (samples[index] ?? 0) / 32768
  }
  return floats
}

export function secondsOf(samples: number): number {
  return samples / STT_SAMPLE_RATE
}
