import type { AnimationTimeline, CameraShot } from '@shared/domain/animation'
import type { Us } from '@shared/domain/time'
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

  let best: CameraShot | null = null
  for (const shot of timeline.shots) {
    if (!cameras.has(shot.cameraId)) continue
    if (time < shot.start || time >= shot.start + shot.duration) continue
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
