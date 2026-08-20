import type { AnimationTimeline, CameraShot } from '@shared/domain/animation'
import { frameDuration, SECOND, snapToFrame, type Us } from '@shared/domain/time'
import { clamp } from '@shared/numeric'
import { movedWithin } from '@shared/domain/order'
import { cachedOn } from '../core/cachedOn'
import { cameraIds, firstCameraId, type SceneNode } from './sceneState'

const cameraLists = new WeakMap<readonly CameraShot[], readonly string[]>()

/**
 * The cameras the band stacks, top first: one line per camera, ranked by where its first shot
 * stands in the list.
 *
 * This IS the montage's law — the order of the lines — and it lives in the document's own list
 * rather than in a number on each shot. A number said the same thing twice: two shots of one
 * camera could hold different `layer` numbers, and the line drawn for them then had no rank.
 */
export function shotCameras(shots: readonly CameraShot[]): readonly string[] {
  return cachedOn(cameraLists, shots, () => [...new Set(shots.map(shot => shot.cameraId))])
}

/**
 * The rails a selection is working on: those selected outright, and those a selected camera
 * rides during a shot.
 *
 * The second half is what ties a rail to its camera on screen — a rail does start at its camera
 * and follow its axis, but with the camera picked and the rail not, the line lay there unmarked.
 *
 * Here rather than in the engine because two sides need the SAME answer: the engine shows the
 * knobs of these rails, and the selection connector lets go of a picked control point as soon as
 * its rail leaves the set. Written twice, a rail worked through its camera would keep its knobs
 * and lose the point one had just grabbed on them.
 */
export function railsInUse(
  selectedIds: readonly string[],
  shots: readonly CameraShot[],
): Set<string> {
  const selected = new Set(selectedIds)
  const rails = new Set(selectedIds)

  for (const shot of shots) {
    if (shot.motion && selected.has(shot.cameraId)) rails.add(shot.motion.pathId)
  }

  return rails
}

/**
 * Which shot is on air at an instant, or `null` when none is.
 *
 * Three rules, in order: the shot has to cover the instant, the camera whose line is highest
 * wins, and between two shots of ONE camera the one laid down latest wins — the montage's law,
 * since a shot hides what is under it where a track would add to it.
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
  const cameras = cameraIds(nodes)
  return bestShot(timeline, time, shot => cameras.has(shot.cameraId))
}

const ranks = new WeakMap<readonly CameraShot[], Map<string, number>>()

/**
 * Where each camera's line stands. `bestShot` asks once per camera and per frame of playback,
 * and rebuilt this every time although nothing in it depends on the camera being asked about.
 */
function cameraRanks(shots: readonly CameraShot[]): Map<string, number> {
  return cachedOn(ranks, shots, () => new Map(shotCameras(shots).map((id, at) => [id, at])))
}

/**
 * The montage's law, written once. What differs between its two callers is only which shots they
 * let compete.
 */
function bestShot(
  timeline: AnimationTimeline,
  time: Us,
  competes: (shot: CameraShot) => boolean,
): CameraShot | null {
  const rank = cameraRanks(timeline.shots)
  let best: { shot: CameraShot; rank: number; at: number } | null = null

  for (const [at, shot] of timeline.shots.entries()) {
    if (time < shot.start || time >= shot.start + shot.duration) continue
    if (!competes(shot)) continue

    const own = rank.get(shot.cameraId) ?? 0
    if (!best || own < best.rank || (own === best.rank && at > best.at)) {
      best = { shot, rank: own, at }
    }
  }

  return best?.shot ?? null
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
 * The shot a camera opens at the head, from the head onwards. At least one frame long, so a shot
 * opened on the last frame still has a bar to grab it back by.
 */
export function newShotAt(
  timeline: AnimationTimeline,
  cameraId: string,
  id: string,
  time: Us,
): CameraShot {
  const start = snapToFrame(clamp(time, 0, timeline.duration), timeline.fps)

  return {
    id,
    cameraId,
    start,
    duration: Math.max(
      frameDuration(timeline.fps),
      Math.min(DEFAULT_SHOT, timeline.duration - start),
    ),
  }
}

/**
 * Where a shot goes in the list, which is what decides its camera's place in the stack.
 *
 * A camera the band does not show yet arrives on TOP — a shot laid down only to be hidden by
 * what was already there reads as a button that did nothing. A camera already on the band keeps
 * its line, the shot joining the end of its own run so the runs stay whole.
 */
export function shotsWith(shots: readonly CameraShot[], shot: CameraShot): readonly CameraShot[] {
  const last = shots.findLastIndex(held => held.cameraId === shot.cameraId)
  if (last === -1) return [shot, ...shots]

  const next = [...shots]
  next.splice(last + 1, 0, shot)
  return next
}

/**
 * The list rewritten with one camera's line moved that many notches down the stack, or `null`
 * when it is already at that end.
 *
 * The whole run of a camera travels, because a line IS a camera: moving one bar out of the run
 * it shares with the others would leave the stack exactly as it was.
 */
export function shotsWithCameraMoved(
  shots: readonly CameraShot[],
  cameraId: string,
  by: number,
): { shots: readonly CameraShot[]; steps: number } | null {
  const cameras = shotCameras(shots)
  // `movedWithin` clamps at both ends and hands the SAME array back when nothing moved, which is
  // exactly the "already at that end" the grip must be told about.
  const moved = movedWithin(cameras, cameraId, by)
  if (moved === cameras) return null

  return {
    shots: moved.flatMap(id => shots.filter(shot => shot.cameraId === id)),
    steps: moved.indexOf(cameraId) - cameras.indexOf(cameraId),
  }
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
