import type { Command } from '../core/history'
import { moveClip, trimClip } from './commands'
import { hitTest, snap, trackAt, xToTime, type Point, type Viewport } from './timeline-geometry'
import {
  clipById,
  clipEnd,
  trackById,
  type SequenceState,
  type Track,
  type Us,
} from './timeline-state'

/**
 * A gesture is data, not component state: that is what makes dragging, trimming and scrubbing
 * testable without a pointer.
 */
export type Gesture =
  | { kind: 'scrub' }
  | { kind: 'drag'; clipId: string; trackId: string; grabOffset: Us }
  | { kind: 'trim'; clipId: string; edge: 'in' | 'out' }

/** Neighbour edges and the playhead — a dragged clip must not stick to itself. */
export function snapCandidates(state: SequenceState, excludeClipId: string | null): Us[] {
  const edges: Us[] = []
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue
      edges.push(clip.start, clipEnd(clip))
    }
  }
  return [...edges, state.playhead]
}

export function beginGesture(
  state: SequenceState,
  viewport: Viewport,
  point: Point,
): Gesture | null {
  const target = hitTest(state, viewport, point)
  if (!target) return null

  if (target.kind === 'ruler') return { kind: 'scrub' }
  if (target.kind === 'edge') return { kind: 'trim', clipId: target.clipId, edge: target.edge }

  if (target.kind === 'clip') {
    const clip = clipById(state, target.clipId)
    if (!clip) return null
    return {
      kind: 'drag',
      clipId: target.clipId,
      trackId: target.trackId,
      // Grab offset, so a clip dragged from its middle does not jump under the cursor.
      grabOffset: xToTime(point.x, viewport) - clip.start,
    }
  }

  return null
}

/** A track takes a clip that came from a track of its own kind, and only if it is unlocked. */
function dropTrack(state: SequenceState, viewport: Viewport, point: Point, from: Track): string {
  const under = trackAt(state, viewport, point)
  return under && !under.locked && under.kind === from.kind ? under.id : from.id
}

export function commandForGesture(
  gesture: Gesture,
  state: SequenceState,
  viewport: Viewport,
  point: Point,
): Command<SequenceState> | null {
  if (gesture.kind === 'scrub') return null

  const raw = xToTime(point.x, viewport)
  const context = {
    settings: state.settings,
    viewport,
    candidates: snapCandidates(state, gesture.clipId),
  }

  if (gesture.kind === 'trim') {
    return trimClip(gesture.clipId, gesture.edge, snap(raw, context))
  }

  const from = trackById(state, gesture.trackId)
  if (!from) return null

  const target = dropTrack(state, viewport, point, from)
  return moveClip(gesture.clipId, target, snap(raw - gesture.grabOffset, context))
}
