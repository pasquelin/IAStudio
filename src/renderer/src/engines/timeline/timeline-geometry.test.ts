import { describe, expect, it } from 'vitest'
import {
  hitTest,
  RULER_HEIGHT,
  snap,
  timeToX,
  TRACK_HEIGHT,
  trackAt,
  trackTop,
  visibleRange,
  xToTime,
  type Viewport,
} from './timeline-geometry'
import { EMPTY_SEQUENCE, type Clip, type SequenceState } from './timeline-state'

/** 100 px per second: one microsecond is 0.0001 px. */
const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  assetId: `asset-${id}`,
  start,
  duration,
  inPoint: 0,
  speed: 1,
})

const stateWith = (clips: Clip[]): SequenceState => ({
  ...EMPTY_SEQUENCE,
  tracks: [{ id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips }],
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

  it('places the first track below the ruler', () => {
    expect(trackTop(0, viewport)).toBe(RULER_HEIGHT)
    expect(trackTop(1, viewport)).toBe(RULER_HEIGHT + TRACK_HEIGHT)
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

  it('hits the body of a clip', () => {
    const target = hitTest(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 50,
      y: RULER_HEIGHT + 10,
    })
    expect(target).toEqual({ kind: 'clip', clipId: 'a', trackId: 'V1' })
  })

  it('hits the out edge of a clip within the grab margin', () => {
    const target = hitTest(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 98,
      y: RULER_HEIGHT + 10,
    })
    expect(target).toEqual({ kind: 'edge', clipId: 'a', trackId: 'V1', edge: 'out' })
  })

  it('hits the ruler, which is what scrubbing listens to', () => {
    expect(hitTest(stateWith([]), viewport, { x: 50, y: 4 })).toEqual({ kind: 'ruler' })
  })

  it('hits empty track space', () => {
    expect(hitTest(stateWith([]), viewport, { x: 50, y: RULER_HEIGHT + 10 })).toEqual({
      kind: 'track',
      trackId: 'V1',
    })
  })

  it('hits nothing below the last track', () => {
    expect(hitTest(stateWith([]), viewport, { x: 50, y: 5_000 })).toBeNull()
  })

  it('reads the track a point lands on, whatever the clip beneath it', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    expect(trackAt(state, viewport, { x: 50, y: RULER_HEIGHT + 10 })?.id).toBe('V1')
    expect(trackAt(state, viewport, { x: 5_000, y: RULER_HEIGHT + 10 })?.id).toBe('V1')
  })

  it('reads no track on the ruler or below the last one', () => {
    const state = stateWith([])
    expect(trackAt(state, viewport, { x: 50, y: 4 })).toBeNull()
    expect(trackAt(state, viewport, { x: 50, y: 5_000 })).toBeNull()
  })

  it('follows the vertical scroll, so a scrolled track is still the one under the pointer', () => {
    const scrolled: Viewport = { ...viewport, scrollTop: TRACK_HEIGHT }
    const state: SequenceState = {
      ...EMPTY_SEQUENCE,
      tracks: [
        { id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips: [] },
        { id: 'A1', kind: 'audio', index: 0, muted: false, locked: false, clips: [] },
      ],
    }

    expect(trackAt(state, scrolled, { x: 50, y: RULER_HEIGHT + 10 })?.id).toBe('A1')
  })
})
