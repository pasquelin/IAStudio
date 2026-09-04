import { emptyGroundPaint, paintGroundDisk, type GroundPaint } from '@shared/domain/groundPaint'
import { SCATTER_MASK_TEXELS, type SceneWorld } from '@shared/domain/scene'
import type { ReliefDiskStroke } from './reliefSculptor'

export type ArmedWorld =
  { kind: 'relief'; id: string; editId: string | null } | { kind: 'scatter'; id: string } | null

type SurfaceDisk = { x: number; z: number; radius: number; amount: number; falloff: number }

export async function groundPaintedAt(
  world: SceneWorld,
  held: ReadonlyMap<string, GroundPaint>,
  load: ((terrainId: string) => Promise<GroundPaint | null>) | undefined,
  terrainId: string,
  disk: SurfaceDisk,
): Promise<GroundPaint | null> {
  const terrain = world.layers.find(layer => layer.kind === 'relief' && layer.id === terrainId)
  if (!terrain || terrain.kind !== 'relief' || terrain.locked.sculpt) return null
  const loaded = held.has(terrainId) ? held.get(terrainId) : await load?.(terrainId)
  return paintGroundDisk(
    loaded ?? emptyGroundPaint(SCATTER_MASK_TEXELS, SCATTER_MASK_TEXELS),
    { origin: terrain.origin, size: terrain.size, elevation: terrain.elevation },
    { ...disk, color: [32, 192, 64, 255] },
  )
}

export function scatterMaskStroke(
  world: SceneWorld,
  scatterId: string,
  disk: SurfaceDisk,
): ReliefDiskStroke | null {
  const scatter = world.layers.find(layer => layer.kind === 'scatter' && layer.id === scatterId)
  if (!scatter || scatter.kind !== 'scatter' || scatter.locked) return null
  if (scatter.mask && scatter.mask.kind !== 'painted') return null
  return {
    samples: {
      width: SCATTER_MASK_TEXELS,
      height: SCATTER_MASK_TEXELS,
      values: new Float32Array(0),
    },
    extent: { origin: scatter.origin, size: scatter.size, elevation: { min: 0, max: 1 } },
    grain: scatter.grain,
    sculpt: scatter.mask?.weights,
    disk: { x: disk.x, z: disk.z, radius: disk.radius },
    amount: disk.amount,
    falloff: disk.falloff,
    kind: 'paintMask',
  }
}
