import type { MaterialDescriptor } from '@shared/domain/scene'
import type { SceneState } from '@/engines/scene/sceneState'

/** Asset ids the standalone runtime can reach, in deterministic first-use order. */
export function runtimeAssetIds(state: SceneState): readonly string[] {
  const found = new Set<string>()
  for (const node of state.nodes) {
    if (node.type === 'mesh' || node.type === 'carved') assetOfMaterial(node.material, found)
    if (node.type === 'model') found.add(node.model.assetId)
  }
  for (const layer of state.world.layers) found.add(layer.heightmap.assetId)
  for (const row of state.animation.audio ?? []) found.add(row.assetId)
  for (const row of state.animation.video ?? []) found.add(row.assetId)
  found.delete('')
  return [...found]
}

/** Pixel assets whose resolution or encoding an explicitly LOSSY export may replace. */
export function runtimeTextureAssetIds(state: SceneState): readonly string[] {
  const found = new Set<string>()
  for (const node of state.nodes) {
    if (node.type === 'mesh' || node.type === 'carved') assetOfMaterial(node.material, found)
  }
  for (const layer of state.world.layers) found.add(layer.heightmap.assetId)
  found.delete('')
  return [...found]
}

function assetOfMaterial(material: MaterialDescriptor, found: Set<string>): void {
  if (material.map) found.add(material.map.assetId)
}
