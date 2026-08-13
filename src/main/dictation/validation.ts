import { STT_CHUNK_SAMPLES } from '@shared/domain/dictation'

/**
 * How much audio one message may carry, in samples.
 *
 * Twice the chunk the capture sends, which leaves room for a worklet that batched two frames
 * without leaving room for a renderer that decided to send a minute at once. The bound is the
 * point: this is the one channel a compromised window could flood.
 */
const MAX_CHUNK_SAMPLES = STT_CHUNK_SAMPLES * 2

/**
 * The 16-bit samples of one chunk, checked rather than trusted.
 *
 * Not zod, unlike every other boundary in the main process: what arrives is an `ArrayBuffer`,
 * and zod would describe it as `unknown` and hand it back unchanged. The two things worth
 * knowing — that it is a buffer, and that it is not absurdly long — are checked here.
 *
 * An oversized or malformed chunk is dropped rather than thrown: this channel is fire and
 * forget, so a throw would settle a promise nobody awaits while the microphone keeps running.
 */
export function parseAudioChunk(chunk: unknown): Int16Array {
  if (!(chunk instanceof ArrayBuffer)) return new Int16Array(0)

  // An odd length is not 16-bit audio; `Int16Array` would throw on the remainder.
  const samples = Math.floor(chunk.byteLength / 2)
  if (samples === 0 || samples > MAX_CHUNK_SAMPLES) return new Int16Array(0)

  return new Int16Array(chunk, 0, samples)
}
