import type { Vector3 } from './scene'
import { SECOND, type Us } from './time'

/**
 * What a track drives. Three for a node, and the same three for one bone of a rig — a bone is
 * addressed by name because it lives inside the file, never in the document (see `ModelRef`).
 */
export type TrackProperty = 'position' | 'rotation' | 'scale'

export const TRACK_PROPERTIES: readonly TrackProperty[] = ['position', 'rotation', 'scale']

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
  /** Sorted by time. Nothing outside the commands may append to this. */
  keys: readonly Keyframe[]
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
}

export const ZERO: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })
export const ONE: Vector3 = Object.freeze({ x: 1, y: 1, z: 1 })

export const DEFAULT_DURATION: Us = 5 * SECOND
export const DEFAULT_FPS = 25

export const EMPTY_TIMELINE: AnimationTimeline = Object.freeze({
  duration: DEFAULT_DURATION,
  fps: DEFAULT_FPS,
  tracks: [],
})

/** What a track adds where it holds no key: nothing for a move or a turn, one for a scale. */
export function neutralOf(property: TrackProperty): Vector3 {
  return property === 'scale' ? ONE : ZERO
}
