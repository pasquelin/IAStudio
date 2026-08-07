import { describe, expect, it } from 'vitest'
import { PEAKS_PER_SECOND } from '@shared/domain/asset'
import type { Viewport } from './timeline-geometry'
import { clipFixture } from './timeline-fixtures'
import { waveformColumns } from './waveform'

/** 100 px per second. One peak pair covers 20 ms, so a pair is two pixels wide here. */
const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

/** `seconds` worth of pairs, each one a flat ±`level`. */
const flat = (seconds: number, level: number): Float32Array => {
  const pairs = seconds * PEAKS_PER_SECOND
  const peaks = new Float32Array(pairs * 2)
  for (let pair = 0; pair < pairs; pair++) {
    peaks[pair * 2] = -level
    peaks[pair * 2 + 1] = level
  }
  return peaks
}

describe('waveform columns', () => {
  it('gives one column per pixel of the clip, not one per stored pair', () => {
    const clip = clipFixture('a', 0, 1_000_000)
    const columns = waveformColumns(clip, flat(1, 0.5), viewport, 0, 800)

    // 100 px wide, the far edge belonging to whatever comes next.
    expect(columns).toHaveLength(100)
    expect(columns[0]).toMatchObject({ x: 0, min: -0.5, max: 0.5 })
  })

  it('paints nothing for a clip with no peaks', () => {
    expect(
      waveformColumns(clipFixture('a', 0, 1_000_000), new Float32Array(), viewport, 0, 800),
    ).toEqual([])
  })

  it('stays inside the window it was given, whatever the clip spans', () => {
    const clip = clipFixture('a', 0, 10_000_000)
    const columns = waveformColumns(clip, flat(10, 0.5), viewport, 200, 260)

    expect(columns[0]?.x).toBe(200)
    expect(columns.at(-1)?.x).toBe(260)
  })

  it('starts reading at the in point rather than at the head of the source', () => {
    const peaks = flat(2, 0)
    // A single loud pair one second in: at 50 pairs a second that is pair 50.
    peaks[50 * 2 + 1] = 1

    const atHead = clipFixture('a', 0, 1_000_000)
    const skipping = clipFixture('b', 0, 1_000_000, { inPoint: 1_000_000 })

    expect(Math.max(...waveformColumns(atHead, peaks, viewport, 0, 800).map(c => c.max))).toBe(0)
    expect(Math.max(...waveformColumns(skipping, peaks, viewport, 0, 800).map(c => c.max))).toBe(1)
  })

  it('keeps the loudest pair when a column spans several of them', () => {
    const peaks = flat(10, 0.1)
    peaks[300 * 2 + 1] = 1

    // Zoomed far out: one pixel covers a whole second, so twenty pairs share a column.
    const wide: Viewport = { scale: 1 / 1_000_000, offset: 0, scrollTop: 0 }
    const columns = waveformColumns(clipFixture('a', 0, 10_000_000), peaks, wide, 0, 800)

    expect(Math.max(...columns.map(column => column.max))).toBe(1)
  })

  it('stops at the end of what was decoded rather than reading past it', () => {
    const clip = clipFixture('a', 0, 10_000_000)
    const columns = waveformColumns(clip, flat(1, 0.5), viewport, 0, 800)

    // One second of peaks at 100 px/s: nothing beyond x = 100 exists to draw.
    expect(columns.at(-1)?.x).toBeLessThanOrEqual(100)
  })
})
