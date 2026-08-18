import type { Transform, Vector3 } from './scene'
import { SECOND, type Us } from './time'

/**
 * What a track drives. Three for a node, and the same three for one bone of a rig — a bone is
 * addressed by name because it lives inside the file, never in the document (see `ModelRef`).
 */
export type TrackProperty = 'position' | 'rotation' | 'scale' | 'fov'

export const TRACK_PROPERTIES: readonly TrackProperty[] = ['position', 'rotation', 'scale', 'fov']

/**
 * The three a pose is made of — what every node can be keyed on, and what `contributionAt`
 * composes. `fov` is deliberately out: it drives a lens rather than a transform, and it is read
 * by `fovAt` alone.
 */
export type PoseProperty = Exclude<TrackProperty, 'fov'>

export const POSE_PROPERTIES: readonly PoseProperty[] = ['position', 'rotation', 'scale']

/**
 * One value at one instant, in microseconds from the start of the timeline — the unit the
 * montage counts in, so both bands share one ruler and one hit test.
 *
 * The value is a DELTA, never an absolute: tracks add up, so what a track holds is what it adds
 * to the pose underneath — nothing at all where it holds no key. It is what makes two tracks on
 * one object a legible thing rather than a fight over who writes last.
 */
export type Keyframe = { time: Us; value: Vector3 }

/** Which object a track writes on, and which of its three values. */
export type TrackTarget = {
  nodeId: string
  /** A bone of that node's model, or the node itself when absent. */
  bone?: string
  property: TrackProperty
}

export type AnimationTrack = {
  id: string
  name: string
  /** Row order, top to bottom. The stack adds up, so unlike a montage nothing hides anything. */
  index: number
  muted: boolean
  solo: boolean
  locked: boolean
  target: TrackTarget
  /**
   * The pose the object stood in when this channel was opened, and what every key is measured
   * against.
   *
   * Without it, keying by hand cannot work at all: moving an object with nothing recording writes
   * its POSITION, so a key posed afterwards would compare that position to itself and hold zero —
   * two keys, no movement, and a Play that shows nothing. Held per channel rather than per node
   * because a bone's rest pose lives in the file, not in the document.
   */
  rest?: Transform
  /** Sorted by time. Nothing outside the commands may append to this. */
  keys: readonly Keyframe[]
}

/** How a camera picks up speed along its rail. A named union, so a drawn curve can join it. */
export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export const EASINGS: readonly Easing[] = ['linear', 'easeIn', 'easeOut', 'easeInOut']

/**
 * What moves a camera during a shot: a rail, and which stretch of it to take.
 *
 * `from` and `to` are normalised abscissae, never seconds — that is what lets a shot take only
 * part of a rail, and what makes `from > to` mean "run it backwards". The clock of the move is
 * the shot's own window, which is why this lives on the shot.
 */
export type CameraMotion = {
  pathId: string
  easing: Easing
  /** 0..1 */
  from: number
  /** 0..1 */
  to: number
}

/**
 * What a camera looks at during a shot. One abstraction for both LOOK AT and TRACK OBJECT: a
 * fixed point, or a node — which may itself be animated.
 *
 * An ORIENTATION target, never a focus distance: depth of field is another chantier entirely.
 */
export type CameraTarget = { kind: 'point'; at: Vector3 } | { kind: 'node'; nodeId: string }

/**
 * One camera, on air from `start` for `duration`.
 *
 * A list of its own rather than a track, and the difference is the whole reason: tracks ADD up
 * (see `AnimationTrack.index`), where at most one camera can be on air at an instant. The rule
 * that settles an overlap is a montage's — the line drawn highest wins, and a line is a camera —
 * and it is read off THIS list's order by `activeShotAt`.
 */
export type CameraShot = {
  id: string
  cameraId: string
  start: Us
  duration: Us
  /** Absent leaves the camera wherever its transform and its tracks put it. */
  motion?: CameraMotion
  /** Absent leaves the camera aimed by its own rotation — FREE, in the language of the trade. */
  target?: CameraTarget
}

/**
 * What a document holds of its animation. The playhead is NOT here: where the head stands is
 * how a scene is being looked at, like the projection and the display mode — and a head written
 * into the document would put one undo entry per frame of playback.
 */
export type AnimationTimeline = {
  /** In microseconds. What the head may not run past, and what a render would cover. */
  duration: Us
  fps: number
  tracks: readonly AnimationTrack[]
  /** Empty on every document written before shots existed, which is what makes them optional. */
  shots: readonly CameraShot[]
}

export const ZERO: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })
export const ONE: Vector3 = Object.freeze({ x: 1, y: 1, z: 1 })

/** What aiming at a fixed point starts as, and the one place its `kind` is spelled out. */
export const POINT_TARGET: Extract<CameraTarget, { kind: 'point' }> = Object.freeze({
  kind: 'point',
  at: ZERO,
})

export const DEFAULT_DURATION: Us = 5 * SECOND
export const DEFAULT_FPS = 25

export const EMPTY_TIMELINE: AnimationTimeline = Object.freeze({
  duration: DEFAULT_DURATION,
  fps: DEFAULT_FPS,
  tracks: [],
  shots: [],
})

/**
 * What a track adds where it holds no key: nothing for a move, a turn or a lens, one for a scale.
 *
 * A `fov` track carries a `Vector3` whose `y` and `z` mean nothing — the price of keeping ONE
 * keyframe shape. `fovAt` is the only reader of `.x`, and a test holds it to that.
 */
export function neutralOf(property: TrackProperty): Vector3 {
  return property === 'scale' ? ONE : ZERO
}
