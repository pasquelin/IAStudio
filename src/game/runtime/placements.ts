// SPDX-License-Identifier: MIT
import type { EntityPlacement } from '../ports/renderPort'
import type { World } from './world'

/**
 * Every entity, every frame, into an array the caller keeps: one object per entity per frame is
 * the only allocation a still game would otherwise make. The port decides what is redrawn.
 */
export function placementsOf(world: World, into: EntityPlacement[]): readonly EntityPlacement[] {
  let count = 0
  for (const entity of world.entities.all()) {
    const held = into[count]
    if (held) {
      held.entity = entity.id
      held.transform = entity.transform
    } else {
      into.push({ entity: entity.id, transform: entity.transform })
    }
    count += 1
  }
  into.length = count
  return into
}
