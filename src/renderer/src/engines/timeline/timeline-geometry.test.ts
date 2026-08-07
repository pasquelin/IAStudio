import { describe, expect, it } from 'vitest'
import {
  fadeHandleTime,
  hitTest,
  rowAt,
  RULER_HEIGHT,
  snap,
  timeToX,
  trackRows,
  tracksHeight,
  trackTop,
  visibleRange,
  xToTime,
  type Viewport,
} from './timeline-geometry'
import {
  DEFAULT_TRACK_HEIGHT,
  EMPTY_SEQUENCE,
  makeClip,
  makeTrack,
  type Clip,
  type SequenceState,
} from './timeline-state'

/** 100 px per second: one microsecond is 0.0001 px. */
const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

const clip = (id: string, start: number, duration: number): Clip =>
  makeClip({ id, assetId: `asset-${id}`, start, duration })

const stateWith = (clips: Clip[]): SequenceState => ({
  ...EMPTY_SEQUENCE,
  tracks: [makeTrack({ id: 'V1', kind: 'video', index: 1, clips })],
})

describe('timeline geometry', () => {
  it('maps a time to a pixel and back', () => {
    expect(timeToX(1_000_000, viewport)).toBe(100)
    expect(xToTime(100, viewport)).toBe(1_000_000)
  })

  it('shifts by the horizontal offset', () => {
    const scrolled: Viewport = { ...viewport, offset: 500_000 }
    expect(timeToX(1_000_000, scrolled)).toBe(50)
    expect(xToTime(50, scrolled)).toBe(1_000_000)
  })

  it('reports the visible time range, so nothing off screen is drawn', () => {
    expect(visibleRange({ ...viewport, offset: 200_000 }, 300)).toEqual([200_000, 3_200_000])
  })

  it('snaps to the nearest candidate inside the threshold', () => {
    const context = {
      settings: EMPTY_SEQUENCE.settings,
      viewport,
      candidates: [1_000_000, 5_000_000],
    }
    expect(snap(1_020_000, context)).toBe(1_000_000)
  })

  it('falls back to the frame grid when no candidate is close enough', () => {
    const context = { settings: EMPTY_SEQUENCE.settings, viewport, candidates: [5_000_000] }
    expect(snap(1_020_000, context)).toBe(1_040_000)
  })
})

describe('rows', () => {
  const uneven: SequenceState = {
    ...EMPTY_SEQUENCE,
    tracks: [
      makeTrack({ id: 'V1', kind: 'video', index: 1, height: 40 }),
      makeTrack({ id: 'A1', kind: 'audio', index: 0, height: 80 }),
    ],
  }

  it('places the first track below the ruler', () => {
    expect(trackTop(EMPTY_SEQUENCE, 0, viewport)).toBe(RULER_HEIGHT)
    expect(trackTop(EMPTY_SEQUENCE, 1, viewport)).toBe(RULER_HEIGHT + DEFAULT_TRACK_HEIGHT)
  })

  it('stacks rows by their own heights rather than by a shared one', () => {
    expect(trackRows(uneven).map(row => row.offset)).toEqual([0, 40])
    expect(trackTop(uneven, 1, viewport)).toBe(RULER_HEIGHT + 40)
    expect(tracksHeight(uneven)).toBe(120)
  })

  it('lifts every row by the vertical scroll', () => {
    expect(trackTop(uneven, 1, { ...viewport, scrollTop: 25 })).toBe(RULER_HEIGHT + 15)
  })

  it('finds the row under a point, whatever its height', () => {
    expect(rowAt(uneven, viewport, RULER_HEIGHT + 10)?.track.id).toBe('V1')
    expect(rowAt(uneven, viewport, RULER_HEIGHT + 50)?.track.id).toBe('A1')
    expect(rowAt(uneven, viewport, RULER_HEIGHT + 500)).toBeNull()
    expect(rowAt(uneven, viewport, 2)).toBeNull()
  })
})

describe('hit testing', () => {
  it('hits the body of a clip', () => {
    const target = hitTest(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 50,
      y: RULER_HEIGHT + 30,
    })
    expect(target).toEqual({ kind: 'clip', clipId: 'a', trackId: 'V1' })
  })

  it('hits the out edge of a clip within the grab margin', () => {
    const target = hitTest(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 98,
      y: RULER_HEIGHT + 30,
    })
    expect(target).toEqual({ kind: 'edge', clipId: 'a', trackId: 'V1', edge: 'out' })
  })

  it('hits the ruler, which is what scrubbing listens to', () => {
    expect(hitTest(stateWith([]), viewport, { x: 50, y: 4 })).toEqual({ kind: 'ruler' })
  })

  it('hits empty track space', () => {
    expect(hitTest(stateWith([]), viewport, { x: 50, y: RULER_HEIGHT + 30 })).toEqual({
      kind: 'track',
      trackId: 'V1',
    })
  })

  it('hits nothing below the last track', () => {
    expect(hitTest(stateWith([]), viewport, { x: 50, y: 5_000 })).toBeNull()
  })

  it('reads a fade handle at the end of its ramp, and at the corner while it is zero', () => {
    const faded = { ...clip('a', 0, 1_000_000), fadeIn: 200_000, fadeOut: 0 }
    expect(fadeHandleTime(faded, 'in')).toBe(200_000)
    expect(fadeHandleTime(faded, 'out')).toBe(1_000_000)
  })

  it('grabs a fade handle along the top of a clip', () => {
    const faded = { ...clip('a', 0, 1_000_000), fadeIn: 200_000, fadeOut: 0 }
    const target = hitTest(stateWith([faded]), viewport, { x: 20, y: RULER_HEIGHT + 4 })
    expect(target).toEqual({ kind: 'fade', clipId: 'a', trackId: 'V1', edge: 'in' })
  })

  it('leaves the same corner to the trim below the fade band', () => {
    const faded = { ...clip('a', 0, 1_000_000), fadeIn: 0, fadeOut: 0 }
    const target = hitTest(stateWith([faded]), viewport, { x: 2, y: RULER_HEIGHT + 30 })
    expect(target).toEqual({ kind: 'edge', clipId: 'a', trackId: 'V1', edge: 'in' })
  })
})
