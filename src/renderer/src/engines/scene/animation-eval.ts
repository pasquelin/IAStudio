import { Euler, Quaternion } from 'three'
import {
  ONE,
  ZERO,
  neutralOf,
  type AnimationTimeline,
  type AnimationTrack,
  type Keyframe,
  type TrackProperty,
} from '@shared/domain/animation'
import type { Transform, Vector3 } from '@shared/domain/scene'

/**
 * What the timeline adds to a pose, and how the additions are combined.
 *
 * Additive was the decision, and it is not the same operation for the three properties: a move
 * adds, a turn COMPOSES — Euler angles added component by component give a wrong result the
 * moment two axes move at once — and a scale MULTIPLIES, its neutral being one rather than zero.
 * Two tracks each doubling an object give it four times its size, which is what an author
 * stacking them means.
 */

/** Scratch, so evaluating a frame allocates nothing: this runs on the frame path. */
const composed = new Quaternion()
const step = new Quaternion()
const angles = new Euler()

const add = (left: Vector3, right: Vector3): Vector3 => ({
  x: left.x + right.x,
  y: left.y + right.y,
  z: left.z + right.z,
})

const multiply = (left: Vector3, right: Vector3): Vector3 => ({
  x: left.x * right.x,
  y: left.y * right.y,
  z: left.z * right.z,
})

/**
 * Where a track stands at that instant. Linear between the two keys around it, and flat outside
 * them — a track that starts at two seconds holds its first value before that rather than easing
 * out of nothing.
 */
export function valueAt(track: AnimationTrack, time: number): Vector3 {
  const keys = track.keys
  if (keys.length === 0) return neutralOf(track.target.property)

  const first = keys[0]
  const last = keys[keys.length - 1]
  if (!first || !last) return neutralOf(track.target.property)
  if (time <= first.time) return first.value
  if (time >= last.time) return last.value

  const after = keys.findIndex(key => key.time > time)
  const right = keys[after]
  const left = keys[after - 1]
  if (!right || !left) return last.value

  const span = right.time - left.time
  // Two keys on the same frame: the later one wins rather than dividing by nothing.
  const ratio = span === 0 ? 1 : (time - left.time) / span
  return {
    x: left.value.x + (right.value.x - left.value.x) * ratio,
    y: left.value.y + (right.value.y - left.value.y) * ratio,
    z: left.value.z + (right.value.z - left.value.z) * ratio,
  }
}

/** A muted track adds nothing; and once anything is soloed, only the soloed ones are heard. */
export function playsThrough(timeline: AnimationTimeline, track: AnimationTrack): boolean {
  if (track.muted) return false
  const soloed = timeline.tracks.some(candidate => candidate.solo)
  return !soloed || track.solo
}

/** The tracks that drive one target, in row order. */
export function tracksFor(
  timeline: AnimationTimeline,
  nodeId: string,
  bone?: string,
): AnimationTrack[] {
  return timeline.tracks.filter(
    track => track.target.nodeId === nodeId && track.target.bone === bone,
  )
}

/**
 * What every track driving one target adds at that instant, as one delta per property.
 *
 * `null` where nothing drives it at all — the caller then leaves the object alone rather than
 * writing back the pose it already had, which is what keeps an untouched scene free of work.
 */
export function contributionAt(
  timeline: AnimationTimeline,
  nodeId: string,
  time: number,
  bone?: string,
): Transform | null {
  const tracks = tracksFor(timeline, nodeId, bone).filter(track => playsThrough(timeline, track))
  if (tracks.length === 0) return null

  let position = ZERO
  let scale = ONE
  composed.identity()
  let turned = false

  for (const track of tracks) {
    const value = valueAt(track, time)

    if (track.target.property === 'position') position = add(position, value)
    else if (track.target.property === 'scale') scale = multiply(scale, value)
    else {
      angles.set(value.x, value.y, value.z)
      step.setFromEuler(angles)
      // Composed, never added: two Euler triples summed component by component describe a
      // rotation neither of them meant as soon as more than one axis is involved.
      composed.multiply(step)
      turned = true
    }
  }

  return {
    position,
    rotation: turned ? eulerOf(composed) : ZERO,
    scale,
  }
}

/** The pose an object stands in at that instant: its own, plus what the tracks add to it. */
export function poseAt(
  rest: Transform,
  timeline: AnimationTimeline,
  nodeId: string,
  time: number,
  bone?: string,
): Transform {
  const delta = contributionAt(timeline, nodeId, time, bone)
  if (!delta) return rest

  angles.set(rest.rotation.x, rest.rotation.y, rest.rotation.z)
  step.setFromEuler(angles)
  angles.set(delta.rotation.x, delta.rotation.y, delta.rotation.z)
  composed.setFromEuler(angles)

  return {
    position: add(rest.position, delta.position),
    rotation: eulerOf(step.multiply(composed)),
    scale: multiply(rest.scale, delta.scale),
  }
}

/**
 * The inverse of `poseAt` for one property: what a track would have to hold for the object to
 * stand there. It is what an armed track receives when the gizmo is dragged — the difference
 * between where the object was put and where it rests, never the absolute pose.
 */
export function deltaOf(rest: Transform, pose: Transform, property: TrackProperty): Vector3 {
  if (property === 'position') {
    return {
      x: pose.position.x - rest.position.x,
      y: pose.position.y - rest.position.y,
      z: pose.position.z - rest.position.z,
    }
  }
  if (property === 'scale') {
    // A rest scale of zero cannot be divided back out; one is the honest answer, and a zero-scaled
    // object shows nothing to drag anyway.
    return {
      x: rest.scale.x === 0 ? 1 : pose.scale.x / rest.scale.x,
      y: rest.scale.y === 0 ? 1 : pose.scale.y / rest.scale.y,
      z: rest.scale.z === 0 ? 1 : pose.scale.z / rest.scale.z,
    }
  }

  angles.set(rest.rotation.x, rest.rotation.y, rest.rotation.z)
  step.setFromEuler(angles).invert()
  angles.set(pose.rotation.x, pose.rotation.y, pose.rotation.z)
  composed.setFromEuler(angles)
  return eulerOf(step.multiply(composed))
}

function eulerOf(quaternion: Quaternion): Vector3 {
  angles.setFromQuaternion(quaternion)
  return { x: angles.x, y: angles.y, z: angles.z }
}

/** Every node the timeline has anything to say about, so the renderer walks no further. */
export function drivenNodes(timeline: AnimationTimeline): Set<string> {
  return new Set(timeline.tracks.map(track => track.target.nodeId))
}

/** Snapped to the frame grid: a playhead between two frames shows a pose no render would. */
export function snapToFrame(time: number, fps: number): number {
  return Math.round(time * fps) / fps
}

export function clampPlayhead(time: number, duration: number): number {
  return Math.min(Math.max(time, 0), duration)
}

/** What a track is called when nobody has named it: what it drives, and what of it. */
export function keyAt(keys: readonly Keyframe[], time: number): Keyframe | undefined {
  return keys.find(key => key.time === time)
}

export function withKey(keys: readonly Keyframe[], key: Keyframe): Keyframe[] {
  const kept = keys.filter(candidate => candidate.time !== key.time)
  return [...kept, key].sort((left, right) => left.time - right.time)
}

export function withoutKey(keys: readonly Keyframe[], time: number): Keyframe[] {
  return keys.filter(key => key.time !== time)
}

export type { TrackProperty }
