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
