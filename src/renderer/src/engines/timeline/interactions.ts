import type { Command } from '../core/history'
import { moveClip, setClipFade, trimClip } from './commands'
import { hitTest, rowAt, snap, xToTime, type Point, type Viewport } from './timeline-geometry'
import {
  clipById,
  clipEnd,
  snapToFrame,
  trackById,
  type ClipEdge,
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
  | { kind: 'trim'; clipId: string; edge: ClipEdge }
  | { kind: 'fade'; clipId: string; edge: ClipEdge }

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
  if (target.kind === 'fade') return { kind: 'fade', clipId: target.clipId, edge: target.edge }
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
  const under = rowAt(state, viewport, point.y)?.track
  return under && !under.locked && under.kind === from.kind ? under.id : from.id
}

/**
 * How long the media behind a clip runs, or null for a still. The catalogue is not part of the
 * sequence, so a trim has to be told — see `trimClip`.
 */
export type MediaLengths = (assetId: string) => Us | null

export function commandForGesture(
  gesture: Gesture,
  state: SequenceState,
  viewport: Viewport,
  point: Point,
  mediaLengths: MediaLengths,
): Command<SequenceState> | null {
  if (gesture.kind === 'scrub') return null

  const raw = xToTime(point.x, viewport)

  if (gesture.kind === 'fade') {
    const clip = clipById(state, gesture.clipId)
    if (!clip) return null

    // The frame grid only: a ramp has no reason to stick to a neighbour's edge, and snapping
    // it there would make a short fade jump to zero as soon as the clips are butt-joined.
    const at = snapToFrame(raw, state.settings)
    const length = gesture.edge === 'in' ? at - clip.start : clipEnd(clip) - at
    return setClipFade(gesture.clipId, gesture.edge, length)
  }

  const context = {
    settings: state.settings,
    viewport,
    candidates: snapCandidates(state, gesture.clipId),
  }

  if (gesture.kind === 'trim') {
    const clip = clipById(state, gesture.clipId)
    if (!clip) return null
    return trimClip(gesture.clipId, gesture.edge, snap(raw, context), mediaLengths(clip.assetId))
  }

  const from = trackById(state, gesture.trackId)
  if (!from) return null

  const target = dropTrack(state, viewport, point, from)
  return moveClip(gesture.clipId, target, snap(raw - gesture.grabOffset, context))
}
