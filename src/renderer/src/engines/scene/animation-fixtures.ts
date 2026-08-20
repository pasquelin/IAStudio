import {
  EMPTY_TIMELINE,
  sheetFromAnimated,
  type AnimationTimeline,
  type AnimationTrack,
  type CameraShot,
  type Keyframe,
  type TrackProperty,
} from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'

export function animationTrack(
  id: string,
  property: TrackProperty,
  keys: Keyframe[],
  extra: Partial<AnimationTrack> = {},
): AnimationTrack {
  return {
    id,
    name: id,
    index: 0,
    muted: false,
    solo: false,
    locked: false,
    target: { nodeId: 'cube', property },
    keys,
    ...extra,
  }
}

export function cameraShot(id: string, extra: Partial<CameraShot> = {}): CameraShot {
  return { id, cameraId: 'cam-a', start: 0, duration: SECOND, ...extra }
}

export function timelineWith(
  tracks: AnimationTrack[],
  extra: Partial<AnimationTimeline> = {},
): AnimationTimeline {
  // The sheet a file comes back with, rather than an empty one: a document that holds tracks and
  // shows nothing is a state no file can be in, and a fixture that spelled it out by hand would
  // drift from `readSheet` the day either moved. `extra` still wins, for the cases that test it.
  const shots = extra.shots ?? EMPTY_TIMELINE.shots
  return { ...EMPTY_TIMELINE, tracks, shots, sheet: sheetFromAnimated(tracks, shots), ...extra }
}
