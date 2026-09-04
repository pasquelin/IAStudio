import { LOD, Object3D, type Mesh } from 'three'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import type { ScatterPose } from '@shared/domain/scatterGenerate'
import { bakedInstancesOf } from './bakedInstances'
import type { BakedInstance } from './sceneState'
import { CELL_SIZE, cellCoords, cellKey, type CellKey, type WorldPartition } from './worldPartition'

export type ScatterBatch = {
  assetId: string
  cell: CellKey
  poses: readonly ScatterPose[]
}

export function scatterBatchKey(assetId: string, cell: CellKey): string {
  return `${assetId}:${cell}`
}

export function scatterBatchesOf(
  poses: readonly ScatterPose[],
  cellAt: (x: number, z: number) => CellKey = defaultCellAt,
): readonly ScatterBatch[] {
  const groups = new Map<string, { assetId: string; cell: CellKey; poses: ScatterPose[] }>()
  for (const pose of poses) {
    const cell = cellAt(pose.x, pose.z)
    const key = scatterBatchKey(pose.assetId, cell)
    const held = groups.get(key)
    if (held) {
      held.poses.push(pose)
      continue
    }
    groups.set(key, { assetId: pose.assetId, cell, poses: [pose] })
  }
  return [...groups.values()]
}

export function scatterDrawnOf(batch: ScatterBatch, source: Mesh): LOD {
  const { cx, cz } = cellCoords(batch.cell)
  const centre = { x: (cx + 0.5) * CELL_SIZE, z: (cz + 0.5) * CELL_SIZE }
  const mesh = bakedInstancesOf(
    source.geometry,
    source.material,
    bakedOf(batch.poses, centre),
    source.matrixWorld,
  )
  const lod = new LOD()
  lod.name = `scatter-${scatterBatchKey(batch.assetId, batch.cell)}`
  lod.position.set(centre.x, 0, centre.z)
  mesh.computeBoundingSphere()
  const radius = mesh.boundingSphere?.radius ?? 1
  lod.addLevel(mesh, 0)
  lod.addLevel(
    bakedInstancesOf(
      source.geometry,
      source.material,
      bakedOf(
        batch.poses.filter((_, index) => index % 4 === 0),
        centre,
      ),
      source.matrixWorld,
    ),
    radius * (DEFAULT_OPTIMIZATION_POLICY.lodDistanceMultipliers[0] ?? 12),
  )
  lod.addLevel(
    new Object3D(),
    radius * (DEFAULT_OPTIMIZATION_POLICY.lodDistanceMultipliers[1] ?? 36),
  )
  return lod
}

export function holdScatterCells(
  batches: readonly ScatterBatch[],
  partition: WorldPartition,
): void {
  const seen = new Set<CellKey>()
  for (const batch of batches) {
    if (seen.has(batch.cell)) continue
    seen.add(batch.cell)
    partition.hold(batch.cell)
  }
}

function bakedOf(
  poses: readonly ScatterPose[],
  centre: { x: number; z: number },
): readonly BakedInstance[] {
  return poses.map((pose, slot) => ({
    sourceId: `${slot}`,
    name: pose.assetId,
    transform: {
      position: { x: pose.x - centre.x, y: pose.y, z: pose.z - centre.z },
      rotation: pose.rotation,
      scale: { x: pose.scale, y: pose.scale, z: pose.scale },
    },
  }))
}

function defaultCellAt(x: number, z: number): CellKey {
  return cellKey(Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE))
}
