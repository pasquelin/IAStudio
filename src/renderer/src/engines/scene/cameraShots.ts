import type { AnimationTimeline, CameraShot } from '@shared/domain/animation'
import { frameDuration, SECOND, snapToFrame, type Us } from '@shared/domain/time'
import { clamp } from '@shared/numeric'
import { firstCameraId, type SceneNode } from './sceneState'

/**
 * Which shot is on air at an instant, or `null` when none is.
 *
 * Three rules, in order: the shot has to cover the instant, the highest layer wins, and at equal
 * layers the one laid down latest wins — the montage's law, since a shot hides what is under it
 * where a track would add to it.
 *
 * A shot whose camera the scene no longer holds is skipped rather than answered: deleting a
 * camera would otherwise leave a black picture in the middle of a sequence. The shot itself is
 * left in the document, so undoing that delete brings the sequence back whole.
 */
export function activeShotAt(
  timeline: AnimationTimeline,
  nodes: readonly SceneNode[],
  time: Us,
): CameraShot | null {
  const cameras = new Set(nodes.flatMap(node => (node.type === 'camera' ? node.id : [])))
  return bestShot(timeline, time, shot => cameras.has(shot.cameraId))
}

/**
 * The montage's law, written once: the highest layer wins, and at equal layers the shot laid
 * down latest. What differs between its two callers is only which shots they let compete.
 */
function bestShot(
  timeline: AnimationTimeline,
  time: Us,
  competes: (shot: CameraShot) => boolean,
): CameraShot | null {
  let best: CameraShot | null = null

  for (const shot of timeline.shots) {
    if (time < shot.start || time >= shot.start + shot.duration) continue
    if (!competes(shot)) continue
    if (
      !best ||
      shot.layer > best.layer ||
      (shot.layer === best.layer && shot.start > best.start)
    ) {
      best = shot
    }
  }
  return best
}

/**
 * The shot driving ONE camera at an instant, whichever camera is on air.
 *
 * Apart from `activeShotAt` because it answers another question: a camera runs its rail while a
 * shot of it covers the instant, whether or not that shot is the one the film is taken through.
 * The preview shows exactly that — what this camera is doing, on air or not.
 */
export function shotOfCameraAt(
  timeline: AnimationTimeline,
  cameraId: string,
  time: Us,
): CameraShot | null {
  return bestShot(timeline, time, shot => shot.cameraId === cameraId)
}

/** How long a shot lasts when nothing says otherwise: what is left of the band, at most this. */
const DEFAULT_SHOT: Us = 3 * SECOND

/**
 * The shot a camera opens at the head: on the layer above every other, from the head onwards.
 *
 * Above, because a shot laid down only to be hidden by what was already on the band reads as a
 * button that did nothing. At least one frame long, so a shot opened on the last frame still has
 * a bar to grab it back by.
 */
export function newShotAt(
  timeline: AnimationTimeline,
  cameraId: string,
  id: string,
  time: Us,
): CameraShot {
  const start = snapToFrame(clamp(time, 0, timeline.duration), timeline.fps)
  const layers = timeline.shots.map(shot => shot.layer)

  return {
    id,
    cameraId,
    layer: layers.length === 0 ? 0 : Math.max(...layers) + 1,
    start,
    duration: Math.max(
      frameDuration(timeline.fps),
      Math.min(DEFAULT_SHOT, timeline.duration - start),
    ),
  }
}

/** Which layer a shot lands on when sent up or down. Never below the ground floor. */
export function layerMoved(shot: CameraShot, by: number): number {
  return Math.max(0, shot.layer + by)
}

/**
 * Where a drag leaves a shot: its body slides, its edges trim it.
 *
 * `null` when nothing would move, so a drag that has not left the frame it started on costs no
 * entry in the history. A shot never shrinks below `minimum` and never starts before zero — a
 * bar of no length would be a shot nothing can grab back.
 */
export function draggedShot(
  shot: CameraShot,
  drag: { edge: 'start' | 'end' | null; grabbedAt: Us },
  at: Us,
  minimum: Us,
): { start: Us; duration: Us } | null {
  const end = shot.start + shot.duration
  let start = shot.start
  let duration = shot.duration

  if (drag.edge === 'start') {
    start = clamp(at, 0, end - minimum)
    duration = end - start
  } else if (drag.edge === 'end') {
    duration = Math.max(minimum, at - shot.start)
  } else {
    start = Math.max(0, at - drag.grabbedAt)
  }

  return start === shot.start && duration === shot.duration ? null : { start, duration }
}

/**
 * What a render looks through at an instant.
 *
 * The one place that decides, for the film, the montage and the viewport alike — two answers
 * would show two different shots of the same scene. With no shot covering the instant it falls
 * back to `firstCameraId`, which is what every document written before shots existed gets.
 */
export function activeCameraAt(
  timeline: AnimationTimeline,
  nodes: readonly SceneNode[],
  time: Us,
): string | null {
  return activeShotAt(timeline, nodes, time)?.cameraId ?? firstCameraId(nodes)
}
