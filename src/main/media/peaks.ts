/**
 * Reads back what `decodePeaks` wrote. Copied rather than viewed: a `Buffer` from `readFile`
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

/**
 * Folds mono 16-bit PCM into min/max pairs as it streams past, rather than holding a whole
 * decode in memory and reducing it afterwards.
 *
 * An hour of the 8 kHz mono ffmpeg is asked for is 57 MB of PCM, and reducing it in one pass
 * measured 129 ms — 129 ms with every window of the studio frozen, since this runs on the main
 * process's own thread (CLAUDE.md, invariant 6). Chunk by chunk it is a fraction of a
 * millisecond at a time, and never more than one chunk is held.
 *
 * The bucket width comes from the sample rate rather than from the total length, so each pair
 * covers exactly the same slice of time whether the file ran short or long of its probe.
 */
export function createPeakReducer(buckets: number, samplesPerBucket: number): PeakReducer {
  const peaks = new Float32Array(buckets * 2)
  const width = Math.max(1, Math.round(samplesPerBucket))
  // A chunk boundary falls anywhere, including between the two bytes of one sample.
  let carry: number | null = null
  let sample = 0

  const fold = (value: number): void => {
    const bucket = Math.floor(sample / width)
    sample += 1
    if (bucket >= buckets) return

    const level = value / 32_768
    if (level < (peaks[bucket * 2] ?? 0)) peaks[bucket * 2] = level
    if (level > (peaks[bucket * 2 + 1] ?? 0)) peaks[bucket * 2 + 1] = level
  }

  // Little-endian and signed, as `s16le` says on the ffmpeg command line.
  const signed = (low: number, high: number): number => {
    const raw = low | (high << 8)
    return raw >= 0x8000 ? raw - 0x10000 : raw
  }

  return {
    push: chunk => {
      let index = 0
      if (carry !== null && chunk.length > 0) {
        fold(signed(carry, chunk[0] ?? 0))
        carry = null
        index = 1
      }

      for (; index + 1 < chunk.length; index += 2) {
        fold(signed(chunk[index] ?? 0, chunk[index + 1] ?? 0))
      }

      if (index < chunk.length) carry = chunk[index] ?? 0
    },

    finish: () => peaks,
  }
}
