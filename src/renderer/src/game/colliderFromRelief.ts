import type { HeightmapSamples } from '@shared/domain/heightmap'
import { reliefReader, worldY } from '@shared/domain/relief'
import type { ReliefLayer } from '@shared/domain/scene'
import type { ColliderShape } from '@game/physics/shape'

/**
 * What a relief is FELT as, derived from the same base+delta grid the surface draws.
 * The heightmap belongs to the studio, so the samples arrive as a parameter.
 */
export function colliderFromRelief(
  layer: ReliefLayer,
  samples: HeightmapSamples,
): ColliderShape | null {
  if (samples.width < 2 || samples.height < 2) return null

  const read = reliefReader(samples, layer.grain, layer.edits)
  const heights = new Float32Array(samples.width * samples.height)
  for (let z = 0; z < samples.height; z++) {
    for (let x = 0; x < samples.width; x++) {
      heights[z * samples.width + x] = worldY(read(x, z), layer.elevation)
    }
  }

  const spanX = Math.max(1, samples.width - 1)
  const spanZ = Math.max(1, samples.height - 1)
  return {
    kind: 'heightfield',
    heights,
    width: samples.width,
    height: samples.height,
    offset: { x: layer.origin.x, y: 0, z: layer.origin.z },
    scale: { x: layer.size.x / spanX, y: 1, z: layer.size.z / spanZ },
  }
}
