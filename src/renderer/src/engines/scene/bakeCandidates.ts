import { stableKey } from '@shared/hash'
import { byCodeUnit } from '@shared/text'
import type { SceneNode } from './sceneState'

export type BakeCandidate = {
  key: string
  sourceIds: readonly string[]
  meshCount: number
}

export function bakeCandidatesOf(
  targets: readonly SceneNode[],
  world: readonly SceneNode[],
  driven: ReadonlySet<string>,
): BakeCandidate[] {
  const parents = new Set(world.flatMap(node => (node.parentId ? [node.parentId] : [])))
  const groups = new Map<string, string[]>()
  for (const node of targets) {
    if (
      node.type !== 'mesh' ||
      node.instances ||
      parents.has(node.id) ||
      driven.has(node.id) ||
      (node.components?.length ?? 0) > 0
    ) {
      continue
    }
    const key = stableKey([
      node.parentId,
      node.geometry,
      node.material,
      node.visible,
      node.castShadow,
      node.receiveShadow,
      node.negative,
    ])
    const group = groups.get(key)
    if (group) group.push(node.id)
    else groups.set(key, [node.id])
  }
  return [...groups]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([key, sourceIds]) => ({
      key,
      sourceIds: sourceIds.sort(byCodeUnit),
      meshCount: sourceIds.length,
    }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
}
