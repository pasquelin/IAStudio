// SPDX-License-Identifier: MIT
import type { Transform } from '@shared/domain/transform'
import { lerpAngle } from '../numeric'
import type { EntityPlacement } from '../ports/renderPort'
import { clonedTransform, copyAxes, copyTransformInto, type Entity } from './entity'
import type { World } from './world'

/**
 * Every entity, drawn between the pose it held before the last step and the one it holds now.
 *
 * 🛑 Transforms of its OWN, never the entity's: a frame sits between two steps and is at neither
 * of them, so handing the live object over judders on every frame the accumulator runs no step.
 */
export function placementsOf(
  world: World,
  into: EntityPlacement[],
  alpha: number,
): readonly EntityPlacement[] {
  let count = 0
  for (const entity of world.entities.all()) {
    let placement = into[count]
    if (!placement) {
      placement = { entity: entity.id, transform: clonedTransform(entity.transform) }
      into.push(placement)
    }

    placement.entity = entity.id
    poseAt(entity, alpha, placement.transform)
    count += 1
  }

  into.length = count
  return into
}

/** Where an entity stands for THIS frame. Its own pose until a step has given it one to come from. */
export function poseAt(entity: Entity, alpha: number, into: Transform): Transform {
  const from = entity.previous
  if (!from) {
    copyTransformInto(into, entity.transform)
    return into
  }

  const to = entity.transform
  lerpAxes(into.position, from.position, to.position, alpha)
  // Angles by their SHORTEST way round: a yaw crossing π would otherwise spin the long way. Euler
  // axis by axis rather than a slerp, which neither allocates nor converts.
  // 🛑 Its blind spot: where `eulerFromQuaternion` flips representation — a pitch at the pole — all
  // three angles jump together, and the frames between are drawn at an orientation neither pose
  // held. A slerp is what fixes it, at three conversions an entity a frame.
  into.rotation.x = lerpAngle(from.rotation.x, to.rotation.x, alpha)
  into.rotation.y = lerpAngle(from.rotation.y, to.rotation.y, alpha)
  into.rotation.z = lerpAngle(from.rotation.z, to.rotation.z, alpha)
  lerpAxes(into.scale, from.scale, to.scale, alpha)
  return into
}

function lerpAxes(
  into: { x: number; y: number; z: number },
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  alpha: number,
): void {
  if (from.x === to.x && from.y === to.y && from.z === to.z) {
    copyAxes(into, to)
    return
  }

  into.x = from.x + (to.x - from.x) * alpha
  into.y = from.y + (to.y - from.y) * alpha
  into.z = from.z + (to.z - from.z) * alpha
}
