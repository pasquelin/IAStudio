// SPDX-License-Identifier: MIT

import type { Transform, Vector3 } from '@shared/domain/transform'
import { lerpAngle } from '../../numeric'
import { restingAxes } from '../../physics/quaternion'
import type { Characters } from '../characters'
import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { flagOf, numberOf, textOf } from '../componentFields'
import { copyAxes, componentOf, restingTransform, type Entity } from '../entity'
import { poseAt } from '../placements'
import { aheadOf, lookOf, type Look } from '../playView'
import type { Rigs } from '../rigs'
import { createTargets, turnTowards } from '../steering'
import type { System, World } from '../world'

const ARM = COMPONENT_DEFAULTS.SpringArm

export type SpringArmOptions = {
  /** The one look the pointer drives, which an arm set to `pointer` hangs behind. */
  characters: Characters
  rigs: Rigs
  /** Where a node hanging from another actually stands. */
  worldOf: (entity: Entity, own: Transform) => Transform
  /** A world pose written back into a node's own frame — nothing when it hangs from nothing. */
  localOf: (entity: Entity, position: Vector3, rotation: Vector3) => Transform | null
  /**
   * Whether a node can be SEEN THROUGH. An arm places whatever it is pointed at, but only a
   * camera takes the shot — filming through a mesh takes the picture from inside the model.
   */
  filmable: (entity: Entity) => boolean
}

/** What one arm remembers between frames: where it had got to, so it can lag behind. */
type Held = { look: Look; at: Vector3 }

/**
 * A camera on an arm, the way Unreal hangs one: it writes the camera NODE, so the outliner shows
 * where the picture is taken from. 🛑 The lag is written against the FRAME's seconds — against the
 * step it would run twice as fast on a screen drawing twice as often.
 */
export function createSpringArmSystem(options: SpringArmOptions): System {
  const { characters, rigs, worldOf, localOf, filmable } = options
  // Two caches, because `createTargets` keeps ONE name per follower and an arm names two.
  const subjects = createTargets()
  const cameras = createTargets()
  const held = new WeakMap<Entity, Held>()
  const axes = restingAxes()

  /** Where the arm points this frame — the player's look, the subject's nose, or its own node. */
  const aimedAt = (orientation: string, anchor: Transform, arm: Entity): Look => {
    if (orientation === 'subject') return lookOf(anchor.rotation, axes, AIMED)
    if (orientation === 'fixed') {
      return lookOf(worldOf(arm, arm.transform).rotation, axes, AIMED)
    }
    return characters.look()
  }

  /** The camera node written where the arm put it, in the frame the node hangs in. */
  const place = (camera: Entity, at: Vector3, rotation: Vector3): void => {
    const local = localOf(camera, at, rotation)
    copyAxes(camera.transform.position, local?.position ?? at)
    copyAxes(camera.transform.rotation, local?.rotation ?? rotation)
  }

  return {
    name: 'springArm',
    reads: ['SpringArm'],
    writes: [],

    lateUpdate: (world: World, alpha: number, dt: number) => {
      // `aim` walks from where it last saw the pointer, so `camera` taking it again after this
      // one moves it by zero — kept honest by `characters.test.ts`.
      characters.aim(world.ports.input.pointer())

      for (const entity of world.entities.withComponent('SpringArm')) {
        const settings = componentOf(entity, 'SpringArm')
        if (!settings) continue

        const subject = subjects.of(world, entity, textOf(settings, 'subject', ARM.subject))
        const camera = cameras.of(world, entity, textOf(settings, 'camera', ARM.camera))
        // A camera filming itself, or filming the thing it hangs behind, frames nothing.
        if (!subject || !camera || camera === subject) continue

        const anchor = worldOf(subject, poseAt(subject, alpha, DRAWN))
        const wanted = aimedAt(textOf(settings, 'orientation', ARM.orientation), anchor, entity)

        let kept = held.get(entity)
        // A first frame snaps: there is nowhere to have lagged from, so no seconds to lag over.
        const over = kept ? dt : 0
        if (!kept) {
          kept = { look: { yaw: 0, pitch: 0 }, at: { x: 0, y: 0, z: 0 } }
          held.set(entity, kept)
        }
        const turn = approach(numberOf(settings, 'rotationLag', ARM.rotationLag), over)
        kept.look.yaw = lerpAngle(kept.look.yaw, wanted.yaw, turn)
        kept.look.pitch += (wanted.pitch - kept.look.pitch) * turn

        // The pivot: the anchor lifted to the height asked for, and pushed off the centre line.
        aheadOf(kept.look, AHEAD)
        const shoulder = numberOf(settings, 'shoulder', ARM.shoulder)
        PIVOT.x = anchor.position.x + Math.cos(kept.look.yaw) * shoulder
        PIVOT.y = anchor.position.y + numberOf(settings, 'height', ARM.height)
        PIVOT.z = anchor.position.z - Math.sin(kept.look.yaw) * shoulder

        const length = numberOf(settings, 'length', ARM.length)
        WANTED.x = PIVOT.x - AHEAD.x * length
        WANTED.y = PIVOT.y - AHEAD.y * length
        WANTED.z = PIVOT.z - AHEAD.z * length

        const glide = approach(numberOf(settings, 'positionLag', ARM.positionLag), over)
        kept.at.x += (WANTED.x - kept.at.x) * glide
        kept.at.y += (WANTED.y - kept.at.y) * glide
        kept.at.z += (WANTED.z - kept.at.z) * glide

        copyAxes(PLACED, kept.at)
        // 🛑 After the lag and never before: a wall must stop the camera on the frame it is met,
        // where a lagged clamp would let the shot walk through it and crawl back out.
        if (flagOf(settings, 'collision', ARM.collision)) {
          IGNORED[0] = subject.id
          IGNORED[1] = camera.id
          const free = world.ports.physics.cast(
            PIVOT,
            PLACED,
            numberOf(settings, 'probeRadius', ARM.probeRadius),
            IGNORED,
          )
          if (free !== null) {
            PLACED.x = PIVOT.x + (PLACED.x - PIVOT.x) * free
            PLACED.y = PIVOT.y + (PLACED.y - PIVOT.y) * free
            PLACED.z = PIVOT.z + (PLACED.z - PIVOT.z) * free
          }
        }

        BACK.x = PIVOT.x - PLACED.x
        BACK.y = PIVOT.y - PLACED.y
        BACK.z = PIVOT.z - PLACED.z
        // 🛑 The look itself when the camera sits ON the pivot — a probe that left no room, or an
        // arm of no length. `turnTowards` leaves a rotation alone for a direction of nothing, and
        // the camera would keep the one the frame before wrote.
        const towards = BACK.x === 0 && BACK.y === 0 && BACK.z === 0 ? AHEAD : BACK
        turnTowards(TURNED, towards, 0)
        place(camera, PLACED, TURNED)
        if (filmable(camera)) rigs.take(camera)
      }
    },
  }
}

/**
 * The share of the way to the mark one frame covers. `1 − e^(−dt/lag)` and never a constant per
 * frame: a constant makes the whole feel depend on how often the screen draws.
 */
function approach(lag: number, dt: number): number {
  if (lag <= 0 || dt <= 0) return 1
  return 1 - Math.exp(-dt / lag)
}

// Rewritten in place: an arm is worked out once a frame and allocates nothing doing it.
const DRAWN = restingTransform()
const AIMED: Look = { yaw: 0, pitch: 0 }
const PIVOT: Vector3 = { x: 0, y: 0, z: 0 }
const WANTED: Vector3 = { x: 0, y: 0, z: 0 }
const PLACED: Vector3 = { x: 0, y: 0, z: 0 }
const AHEAD: Vector3 = { x: 0, y: 0, z: 0 }
const BACK: Vector3 = { x: 0, y: 0, z: 0 }
const TURNED: Vector3 = { x: 0, y: 0, z: 0 }
const IGNORED: string[] = ['', '']
