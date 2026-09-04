import { chunkLayout, texelStep, type ReliefChunkKey, type ReliefExtent } from './relief'
import type { ScatterFollowRelief, ScatterLayer } from './scatter'
import {
  scatterPosesOf,
  type ScatterGround,
  type ScatterPose,
  type ScatterRegion,
} from './scatterGenerate'

export type ScatterRebuild =
  { kind: 'none' } | { kind: 'all' } | { kind: 'brush'; region: ScatterRegion }

/**
 * What a scatter layer must rebuild after a relief sculpt. Subscribes to `dirtiedChunks` —
 * no second notification bus.
 */
export function scatterRebuildOf(
  follow: ScatterFollowRelief,
  dirtied: readonly ReliefChunkKey[],
  terrain: ReliefExtent & { grain: number; samples: { width: number; height: number } },
): ScatterRebuild {
  if (follow === 'none' || dirtied.length === 0) return { kind: 'none' }
  if (follow === 'layer') return { kind: 'all' }
  return { kind: 'brush', region: regionOf(dirtied, terrain) }
}

export function scatterPosesAfterSculpt(
  layer: ScatterLayer,
  previous: readonly ScatterPose[],
  rebuild: ScatterRebuild,
  ground: ScatterGround,
): readonly ScatterPose[] {
  if (rebuild.kind === 'none') return previous
  if (rebuild.kind === 'all') {
    return scatterPosesOf(layer, layerRegion(layer), ground)
  }
  const kept = previous.filter(
    pose =>
      pose.x < rebuild.region.minX ||
      pose.x >= rebuild.region.maxX ||
      pose.z < rebuild.region.minZ ||
      pose.z >= rebuild.region.maxZ,
  )
  return [...kept, ...scatterPosesOf(layer, rebuild.region, ground)]
}

function layerRegion(layer: ScatterLayer): ScatterRegion {
  return {
    minX: layer.origin.x,
    minZ: layer.origin.z,
    maxX: layer.origin.x + layer.size.x,
    maxZ: layer.origin.z + layer.size.z,
  }
}

function regionOf(
  dirtied: readonly ReliefChunkKey[],
  terrain: ReliefExtent & { grain: number; samples: { width: number; height: number } },
): ScatterRegion {
  const step = texelStep(terrain.size, terrain.samples)
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const chunk of dirtied) {
    const layout = chunkLayout(
      chunk.column,
      chunk.row,
      terrain.samples.width,
      terrain.samples.height,
      terrain.grain,
    )
    const x0 = terrain.origin.x + layout.sampleX * step.x
    const z0 = terrain.origin.z + layout.sampleZ * step.z
    minX = Math.min(minX, x0)
    minZ = Math.min(minZ, z0)
    maxX = Math.max(maxX, x0 + layout.width * step.x)
    maxZ = Math.max(maxZ, z0 + layout.height * step.z)
  }
  return { minX, minZ, maxX, maxZ }
}
