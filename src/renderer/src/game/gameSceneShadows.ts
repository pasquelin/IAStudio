import type { Object3D } from 'three'
import { applyShadowFlags } from '@/engines/scene/shadows'
import { receivesShadow, type SceneNode } from '@/engines/scene/sceneState'

/**
 * 🛑 The flags a node carries, read through the same two answers the editor reads — lights and
 * models included. It stops at a child standing for a node of its own, which carries its own.
 */
export function dressShadows(
  nodes: readonly SceneNode[],
  byEntity: ReadonlyMap<string, Object3D>,
): void {
  const ownObjects = new Set(byEntity.values())
  // Identity, not the name `ownedByAnotherNode` reads: a game names its objects after the NODE,
  // where the editor names them after its id.
  const belongsElsewhere = (child: Object3D): boolean => ownObjects.has(child)
  for (const node of nodes) {
    const object = byEntity.get(node.id)
    if (!object) continue
    applyShadowFlags(object, node.castShadow, receivesShadow(node), belongsElsewhere)
  }
}
