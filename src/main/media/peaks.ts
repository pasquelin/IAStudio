/**
 * Reads back what `decodePeaks` wrote. Copied rather than viewed: a `Buffer` from `readFile`
 * shares a pooled `ArrayBuffer` whose offset is rarely four-byte aligned, and `Float32Array`
 * refuses an unaligned view outright.
 */
export function peaksFromBytes(bytes: Uint8Array): Float32Array {
  const usable = bytes.byteLength - (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT)
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + usable))
}

/**
 * An `Int16Array` cannot be laid over an odd byte offset, and a `Buffer` is a view into a
 * pooled allocation at whatever offset the pool gave it. `new Uint8Array(pcm)` rather than
 * `pcm.slice()`: on a `Buffer`, `slice` is an alias of `subarray` and returns the same offset.
 */
export function samplesOf(pcm: Uint8Array): Int16Array {
  const aligned = pcm.byteOffset % Int16Array.BYTES_PER_ELEMENT === 0 ? pcm : new Uint8Array(pcm)
  return new Int16Array(
    aligned.buffer,
    aligned.byteOffset,
    Math.floor(aligned.length / Int16Array.BYTES_PER_ELEMENT),
  )
}

/**
 * One min/max pair per bucket, normalised to -1..1. Computed once at ingest and written to
 * disk: recomputing a waveform while painting a timeline is how scrolling starts to stutter.
 */
export function decodePeaks(pcm: Int16Array, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets * 2)
  const size = Math.max(1, Math.ceil(pcm.length / buckets))

  for (let bucket = 0; bucket < buckets; bucket++) {
    let min = 0
    let max = 0

    for (let index = bucket * size; index < Math.min((bucket + 1) * size, pcm.length); index++) {
      const value = (pcm[index] ?? 0) / 32_768
      if (value < min) min = value
      if (value > max) max = value
    }

    peaks[bucket * 2] = min
    peaks[bucket * 2 + 1] = max
  }

  return peaks
}
