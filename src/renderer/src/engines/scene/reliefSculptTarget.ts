import type { SceneWorld } from '@shared/domain/scene'

export type ReliefBrush = {
  terrainId: string
  editId: string
  radius: number
  amount: number
}

export function reliefBrushOf(world: SceneWorld): ReliefBrush | null {
  const candidates = world.layers.flatMap(layer => {
    if (layer.kind !== 'relief' || !layer.enabled || layer.locked.sculpt) return []
    return layer.edits
      .filter(edit => edit.enabled && !edit.locked)
      .map(edit => ({
        terrainId: layer.id,
        editId: edit.id,
        radius: Math.min(layer.size.x, layer.size.z) / 40,
        amount: Math.abs(layer.elevation.max - layer.elevation.min) / 100,
      }))
  })
  return candidates.length === 1 ? (candidates[0] ?? null) : null
}
