import { Box3, type Object3D } from 'three'
import type { SceneNodeType } from './sceneState'

/**
 * What a framing and a shadow frustum both leave out — see `frameContents`. Lights and cameras
 * are placed away from what they light or watch, and a group is only ever as big as its children,
 * which are counted on their own.
 */
export const UNFRAMED_NODES: ReadonlySet<SceneNodeType> = new Set<SceneNodeType>([
  'light',
  'camera',
  'group',
  'path',
])

/**
 * Spelled as what is LEFT OUT: a node kind added to the union is framed by default, where a
 * whitelist would have quietly stopped framing it.
 */
export const isFramed = (type: SceneNodeType): boolean => !UNFRAMED_NODES.has(type)

/** An empty box for an empty set, which is how a caller tells "nothing yet" from "nothing there". */
export function boundsOf(objects: Iterable<Object3D>): Box3 {
  const bounds = new Box3()
  for (const object of objects) bounds.expandByObject(object)
  return bounds
}
