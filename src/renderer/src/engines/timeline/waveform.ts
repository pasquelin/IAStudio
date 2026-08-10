import { PEAKS_PER_SECOND } from '@shared/domain/asset'
import { clamp } from '@shared/numeric'
import { timeToX, xToTime, type Viewport } from './timeline-geometry'
import { clipEnd, type Clip } from './timeline-state'

/** One pixel column of a waveform, as the two extremes the ear would have heard there. */
export type WaveColumn = { x: number; min: number; max: number }

/**
 * The waveform of a clip, one column per pixel rather than one per stored pair.
 *
 * That is what makes it affordable: a three-minute take holds nine thousand pairs, the clip is
 * two hundred pixels wide, and drawing the pairs would be forty-five times the work for the
 * same picture. Zoomed the other way, one pixel spans many pairs and the loudest of them wins,
 * so a transient never disappears between two columns.
 */
export function waveformColumns(
  clip: Clip,
  peaks: Float32Array,
  viewport: Viewport,
  from: number,
  to: number,
): WaveColumn[] {
  const pairs = Math.floor(peaks.length / 2)
  if (pairs === 0) return []

  const left = Math.max(from, Math.ceil(timeToX(clip.start, viewport)))
  // The clip's right edge is exclusive: the pixel sitting on it belongs to whatever comes next,
  // and reading it would sample one pair past the end of the take.
  const right = Math.min(to, Math.ceil(timeToX(clipEnd(clip), viewport)) - 1)
  const columns: WaveColumn[] = []

  const indexAt = (x: number): number => {
    // Timeline time → time inside the source, through the in point and the speed.
    const source = clip.inPoint + (xToTime(x, viewport) - clip.start) * clip.speed
    return Math.floor((source / 1_000_000) * PEAKS_PER_SECOND)
  }

  for (let x = left; x <= right; x++) {
    const start = Math.max(0, indexAt(x))
    // One column can span many pairs; the loudest of them is what has to survive.
    const end = clamp(indexAt(x + 1), start + 1, pairs)
    if (start >= pairs) break

    let min = 0
    let max = 0
    for (let pair = start; pair < end; pair++) {
      min = Math.min(min, peaks[pair * 2] ?? 0)
      max = Math.max(max, peaks[pair * 2 + 1] ?? 0)
    }

    columns.push({ x, min, max })
  }

  return columns
}
