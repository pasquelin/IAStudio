/**
 * Reads back what the reducer wrote. Copied rather than viewed: a `Buffer` from `readFile`
 * shares a pooled `ArrayBuffer` whose offset is rarely four-byte aligned, and `Float32Array`
 * refuses an unaligned view outright.
 */
export function peaksFromBytes(bytes: Uint8Array): Float32Array {
  const usable = bytes.byteLength - (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT)
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + usable))
}

/** What a reducer needs to fold PCM into a waveform as it arrives. */
export type PeakReducer = {
  /** Feeds bytes in, in the order ffmpeg wrote them. A sample split across two chunks is kept. */
  push: (chunk: Uint8Array) => void
  /** The finished waveform. The reducer is spent afterwards. */
  finish: () => Float32Array
}

const FULL_SCALE = 32_768

/**
 * Folds mono 16-bit PCM into min/max pairs as it streams past, rather than holding a whole
 * decode to reduce afterwards: an hour of the 8 kHz mono ffmpeg is asked for is 57 MB, and this
 * runs on the main process's own thread (CLAUDE.md, invariant 6).
 *
 * The bucket width comes from the sample rate rather than from the total length, so each pair
 * covers the same slice of time whether the file ran short or long of its probe.
 */
export function createPeakReducer(buckets: number, samplesPerBucket: number): PeakReducer {
  const peaks = new Float32Array(buckets * 2)
  const width = Math.max(1, Math.round(samplesPerBucket))

  // The running bucket is held in locals and written once, at its end: a division, two guarded
  // reads and two writes per sample cost more than the whole rest of the loop.
  let bucket = 0
  let left = width
  let min = 0
  let max = 0
  // A chunk boundary falls anywhere, including between the two bytes of one sample.
  let carry = -1

  const fold = (value: number): void => {
    if (bucket >= buckets) return

    if (value < min) min = value
    else if (value > max) max = value

    if (--left > 0) return
    peaks[bucket * 2] = min / FULL_SCALE
    peaks[bucket * 2 + 1] = max / FULL_SCALE
    bucket += 1
    left = width
    min = 0
    max = 0
  }

  // Little-endian, as `s16le` says on the ffmpeg command line; `<< 16 >> 16` sign-extends.
  const signed = (low: number, high: number): number => ((low | (high << 8)) << 16) >> 16

  return {
    push: chunk => {
      let index = 0
      if (carry >= 0 && chunk.length > 0) {
        fold(signed(carry, chunk[0] ?? 0))
        carry = -1
        index = 1
      }

      const last = chunk.length - 1
      for (; index < last; index += 2) {
        fold(signed(chunk[index] ?? 0, chunk[index + 1] ?? 0))
      }

      carry = index < chunk.length ? (chunk[index] ?? 0) : -1
    },

    // The bucket in progress is written out: a file rarely ends on a bucket boundary, and
    // dropping the tail would flatten the last fraction of a second to silence.
    finish: () => {
      if (left < width && bucket < buckets) {
        peaks[bucket * 2] = min / FULL_SCALE
        peaks[bucket * 2 + 1] = max / FULL_SCALE
      }
      return peaks
    },
  }
}
