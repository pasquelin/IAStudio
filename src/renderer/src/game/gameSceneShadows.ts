import { Box3, type Object3D } from 'three'
import { applyShadowFlags, shadowReachOf } from '@/engines/scene/shadows'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { receivesShadow, type SceneNode } from '@/engines/scene/sceneState'
import { isFramed } from '@/engines/scene/framedNodes'

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

/**
 * 🛑 What a shadow frustum is measured against: the nodes that DRAW something, never the ground,
 * the scatter or the relief. A scatter spans the world — a frustum cut to it spreads one shadow map
 * over kilometres, which is `measureShadowReach` reading `framedObjects` and not the scene.
 */
export function shadowBoundsOf(
  nodes: readonly SceneNode[],
  byEntity: ReadonlyMap<string, Object3D>,
): Box3 {
  const bounds = new Box3()
  for (const node of nodes) {
    const object = isFramed(node.type) ? byEntity.get(node.id) : undefined
    if (object) bounds.expandByObject(object)
  }
  return bounds
}

/**
 * 🛑 Floored on the editor's own grid, never on zero: an empty box would write a zero-wide
 * orthographic frustum, whose projection matrix carries Infinity and rasterises no shadow at all.
 */
export function gameShadowReach(bounds: Box3): number {
  return shadowReachOf(bounds, DEFAULT_SETTINGS.three.gridSize)
}
