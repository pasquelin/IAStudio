import {
  EMPTY_TIMELINE,
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
  return { ...EMPTY_TIMELINE, tracks, ...extra }
}
