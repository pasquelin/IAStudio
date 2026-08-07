import { lightByKind, type LightType } from './light-types'
import {
  IDENTITY_TRANSFORM,
  type LightDescriptor,
  type SceneNode,
  type SceneState,
  type Vector3,
} from './scene-state'

export function createNodeId(): string {
  return crypto.randomUUID()
}

/**
 * Takes the registry entry rather than its kind: a lookup here could miss, and the caller is
 * better placed to decide what a missing kind means than a constructor that would have to throw.
 */
function lightNode(type: LightType, position: Vector3): SceneNode {
  const light = type.create()
  return {
    id: createNodeId(),
    parentId: null,
    // The three.js editor names a light after its class, and so does any scene exported from it.
    name: `${light.kind.charAt(0).toUpperCase()}${light.kind.slice(1)}Light`,
    visible: true,
    transform: { ...IDENTITY_TRANSFORM, position },
    type: 'light',
    light,
  }
}

const DEFAULT_LIGHTS: readonly [LightDescriptor['kind'], Vector3][] = [
  ['ambient', { x: 0, y: 0, z: 0 }],
  ['directional', { x: 5, y: 10, z: 7.5 }],
  ['hemisphere', { x: 0, y: 10, z: 0 }],
]

/**
 * A new scene is born lit, as in the official editor. An unlit one shows nothing at all, and
 * reads as a broken viewport rather than as an empty document.
 *
 * A kind the registry no longer knows is skipped rather than thrown on: `default-scene.test.ts`
 * is what catches a lost entry, and a new document must open whatever happens.
 */
export function createDefaultScene(): SceneState {
  return {
    nodes: DEFAULT_LIGHTS.flatMap(([kind, position]) => {
      const type = lightByKind(kind)
      return type ? [lightNode(type, position)] : []
    }),
    selectedId: null,
  }
}
