import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { LIGHT_TYPES } from './light-types'
import { lightNode } from './node-factory'
import { STUDIO_ENVIRONMENT, type LightDescriptor, type Vector3 } from '@shared/domain/scene'
import type { SceneState } from './scene-state'

/** Which lights a new scene opens with, and where. A kind absent here is simply not one of them. */
const DEFAULT_LIGHT_POSITIONS: ReadonlyMap<LightDescriptor['kind'], Vector3> = new Map([
  ['ambient', { x: 0, y: 0, z: 0 }],
  ['directional', { x: 5, y: 10, z: 7.5 }],
  ['hemisphere', { x: 0, y: 10, z: 0 }],
])

/** A new scene is born lit: an unlit one reads as a broken viewport, not as an empty document. */
export function createDefaultScene(): SceneState {
  return {
    nodes: LIGHT_TYPES.flatMap(type => {
      const position = DEFAULT_LIGHT_POSITIONS.get(type.kind)
      return position ? [lightNode(type.create(), position)] : []
    }),
    selectedIds: [],
    environment: STUDIO_ENVIRONMENT,
    animation: EMPTY_TIMELINE,
  }
}
