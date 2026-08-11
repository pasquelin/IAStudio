import { placeRows, rowAtOffset, rowsHeight } from './band'
import {
  clipEnd,
  snapToFrame,
  CLIP_EDGES,
  type Clip,
  type ClipEdge,
  type SequenceSettings,
  type SequenceState,
  type Track,
  type Us,
} from './timeline-state'

export type { ClipEdge }

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
  | { kind: 'edge'; clipId: string; trackId: string; edge: ClipEdge }
  | { kind: 'fade'; clipId: string; trackId: string; edge: ClipEdge }

export const RULER_HEIGHT = 24
/** Pixels around a clip edge that grab the edge rather than the body. */
export const EDGE_GRAB = 6
/** Pixels around a fade handle that grab it. */
export const FADE_GRAB = 7
/** Depth of the strip along a clip's top where fade handles win over everything else. */
export const FADE_BAND = 12
/** Pixels within which a snap candidate wins over the frame grid. */
export const SNAP_THRESHOLD = 8
/** Inset of a clip's rectangle inside its row, so neighbouring rows stay readable. */
export const CLIP_INSET = 2

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

export type TrackRow = {
  track: Track
  /** Distance from the top of the first row, before the ruler and the scroll are applied. */
  offset: number
}

/**
 * Rows are stacked in track order with their own heights, so every reader — painter, hit test,
 * header column — derives a position the same way instead of each cumulating its own. The stack
 * itself is `band.ts`, which a scene's animation lays out the same way.
 */
export function trackRows(state: SequenceState): TrackRow[] {
  return placeRows(state.tracks).map(({ item, offset }) => ({ track: item, offset }))
}

export function tracksHeight(state: SequenceState): number {
  return rowsHeight(state.tracks)
}

export function trackTop(state: SequenceState, index: number, viewport: Viewport): number {
  const rows = trackRows(state)
  const row = rows[index]
  const offset = row ? row.offset : tracksHeight(state)
  return RULER_HEIGHT + offset - viewport.scrollTop
}

/** The row under a vertical coordinate, or nothing below the last track. */
export function rowAt(state: SequenceState, viewport: Viewport, y: number): TrackRow | null {
  const found = rowAtOffset(state.tracks, y + viewport.scrollTop - RULER_HEIGHT)
  return found ? { track: found.item, offset: found.offset } : null
}

export function visibleRange(viewport: Viewport, width: number): [Us, Us] {
  return [viewport.offset, viewport.offset + Math.round(width / viewport.scale)]
}

/** Where a fade handle sits: at the end of its ramp, which is the clip corner while it is zero. */
export function fadeHandleTime(clip: Clip, edge: ClipEdge): Us {
  return edge === 'in' ? clip.start + clip.fadeIn : clipEnd(clip) - clip.fadeOut
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

  const row = rowAt(state, viewport, point.y)
  if (!row) return null

  const { track } = row
  const top = RULER_HEIGHT + row.offset - viewport.scrollTop
  const inBand = point.y - top <= FADE_BAND

  for (const clip of track.clips) {
    const left = timeToX(clip.start, viewport)
    const right = timeToX(clipEnd(clip), viewport)
    if (point.x < left || point.x > right) continue

    // Fades win in the top band only: below it the same corner has to stay grabbable for a trim.
    if (inBand) {
      for (const edge of CLIP_EDGES) {
        const handle = timeToX(fadeHandleTime(clip, edge), viewport)
        if (Math.abs(point.x - handle) <= FADE_GRAB) {
          return { kind: 'fade', clipId: clip.id, trackId: track.id, edge }
        }
      }
    }

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
