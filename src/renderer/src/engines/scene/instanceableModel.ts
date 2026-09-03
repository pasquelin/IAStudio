import type { AnimationClip, Object3D } from 'three'
import type { RigStatus } from './rigState'
import type { SceneNode } from './sceneState'

const INSTANCEABLE = new WeakSet<Object3D>()

/**
 * A model the grouping may draw as instances: a static mesh, no dress, no clip of its own or
 * of the file. Skinned, animated, or dressed nodes stay on the clone path.
 */
export function instanceableOf(
  node: SceneNode,
  rig: { status: RigStatus },
  fileClips: readonly AnimationClip[],
): boolean {
  if (node.type !== 'model') return false
  if (rig.status !== 'staticMesh') return false
  if (node.model.dress) return false
  if (fileClips.length > 0) return false
  return !node.model.lanes?.some(lane => lane.clips.length > 0)
}

export function markInstanceable(holder: Object3D, eligible: boolean): void {
  if (eligible) INSTANCEABLE.add(holder)
  else INSTANCEABLE.delete(holder)
}

export function isInstanceable(holder: Object3D): boolean {
  return INSTANCEABLE.has(holder)
}
