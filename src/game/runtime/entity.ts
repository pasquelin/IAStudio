// SPDX-License-Identifier: MIT

import type { Component, ComponentType } from '@shared/domain/component'
import type { Transform } from '@shared/domain/transform'

/**
 * What the runtime moves, as opposed to what a document holds.
 *
 * MUTABLE, and deliberately: a step writes `transform.position.x` in place rather than rebuilding
 * an object per entity per frame. The edit state stays immutable, in the document store, and the
 * runtime holds no reference to it — which is what makes Play Mode safe by construction.
 */
export type Entity = {
  readonly id: string
  name: string
  transform: Transform
  components: Component[]
}

/**
 * A fresh transform at the origin. Not `IDENTITY_TRANSFORM`, which is a shared CONSTANT a step
 * would be writing into — and not a value this tree may import anyway.
 */
export function restingTransform(): Transform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
}

/** The one component of that type an entity carries, or nothing. */
export function componentOf(entity: Entity, type: ComponentType): Component | null {
  return entity.components.find(component => component.type === type) ?? null
}
