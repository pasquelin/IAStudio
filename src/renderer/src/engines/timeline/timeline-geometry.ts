import {
  clipEnd,
  snapToFrame,
  type SequenceSettings,
  type SequenceState,
  type Us,
} from './timeline-state'

/**
 * What the timeline canvas paints and what the pointer lands on, as pure functions: jsdom has
 * no usable 2D context, and these are the rules worth testing.
 */
export type Viewport = {
  /** Pixels per microsecond. */
  scale: number
  /** Time at the left edge. */
  offset: Us
  scrollTop: number
}

export type Point = { x: number; y: number }

export type HitTarget =
  | { kind: 'ruler' }
  | { kind: 'track'; trackId: string }
  | { kind: 'clip'; clipId: string; trackId: string }
  | { kind: 'edge'; clipId: string; trackId: string; edge: 'in' | 'out' }

export const RULER_HEIGHT = 24
export const TRACK_HEIGHT = 56
/** Pixels around a clip edge that grab the edge rather than the body. */
export const EDGE_GRAB = 6
/** Pixels within which a snap candidate wins over the frame grid. */
export const SNAP_THRESHOLD = 8

export type SnapContext = {
  settings: SequenceSettings
  viewport: Viewport
  /** Neighbour edges and the playhead — everything worth sticking to. */
  candidates: readonly Us[]
}

export function timeToX(time: Us, viewport: Viewport): number {
  return (time - viewport.offset) * viewport.scale
}

export function xToTime(x: number, viewport: Viewport): Us {
  return Math.round(x / viewport.scale + viewport.offset)
}

export function trackTop(index: number, viewport: Viewport): number {
  return RULER_HEIGHT + index * TRACK_HEIGHT - viewport.scrollTop
}

export function visibleRange(viewport: Viewport, width: number): [Us, Us] {
  return [viewport.offset, viewport.offset + Math.round(width / viewport.scale)]
}

export function snap(time: Us, context: SnapContext): Us {
  const threshold = SNAP_THRESHOLD / context.viewport.scale
  let best: Us | null = null

  for (const candidate of context.candidates) {
    const distance = Math.abs(candidate - time)
    if (distance > threshold) continue
    if (best === null || distance < Math.abs(best - time)) best = candidate
  }

  return best ?? snapToFrame(time, context.settings)
}

export function hitTest(state: SequenceState, viewport: Viewport, point: Point): HitTarget | null {
  if (point.y < RULER_HEIGHT) return { kind: 'ruler' }

  const row = Math.floor((point.y + viewport.scrollTop - RULER_HEIGHT) / TRACK_HEIGHT)
  const track = state.tracks[row]
  if (!track) return null

  for (const clip of track.clips) {
    const left = timeToX(clip.start, viewport)
    const right = timeToX(clipEnd(clip), viewport)
    if (point.x < left || point.x > right) continue

    if (point.x <= left + EDGE_GRAB) {
      return { kind: 'edge', clipId: clip.id, trackId: track.id, edge: 'in' }
    }
    if (point.x >= right - EDGE_GRAB) {
      return { kind: 'edge', clipId: clip.id, trackId: track.id, edge: 'out' }
    }
    return { kind: 'clip', clipId: clip.id, trackId: track.id }
  }

  return { kind: 'track', trackId: track.id }
}
