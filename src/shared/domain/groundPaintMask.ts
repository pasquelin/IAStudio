import type { GroundPaint } from './groundPaint'
import { packDeltas, type ReliefSculpt } from './relief'
import { SCATTER_MASK_TEXELS } from './scatter'

export type PaintExtent = { origin: { x: number; z: number }; size: { x: number; z: number } }

export function scatterMaskFromGroundPaint(
  paint: GroundPaint,
  source: PaintExtent,
  target: PaintExtent,
  grain: number,
): ReliefSculpt {
  const weights = new Float32Array(SCATTER_MASK_TEXELS * SCATTER_MASK_TEXELS)
  for (let z = 0; z < SCATTER_MASK_TEXELS; z += 1) {
    for (let x = 0; x < SCATTER_MASK_TEXELS; x += 1) {
      const worldX = target.origin.x + (x / (SCATTER_MASK_TEXELS - 1)) * target.size.x
      const worldZ = target.origin.z + (z / (SCATTER_MASK_TEXELS - 1)) * target.size.z
      weights[z * SCATTER_MASK_TEXELS + x] = paintedWeightAt(paint, source, worldX, worldZ)
    }
  }
  return packedWeights(weights, grain)
}

function paintedWeightAt(
  paint: GroundPaint,
  extent: PaintExtent,
  worldX: number,
  worldZ: number,
): number {
  const u = (worldX - extent.origin.x) / extent.size.x
  const v = (worldZ - extent.origin.z) / extent.size.z
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0
  const x = Math.round(u * (paint.width - 1))
  const z = Math.round(v * (paint.height - 1))
  const offset = (z * paint.width + x) * 4
  return ((paint.pixels[offset + 1] ?? 0) / 255) * ((paint.pixels[offset + 3] ?? 0) / 255)
}

function packedWeights(weights: Float32Array, grain: number): ReliefSculpt {
  const chunks: ReliefSculpt['chunks'][number][] = []
  for (let row = 0; row < Math.ceil(SCATTER_MASK_TEXELS / grain); row += 1) {
    for (let column = 0; column < Math.ceil(SCATTER_MASK_TEXELS / grain); column += 1) {
      const width = Math.min(grain, SCATTER_MASK_TEXELS - column * grain)
      const height = Math.min(grain, SCATTER_MASK_TEXELS - row * grain)
      const chunk = new Float32Array(width * height)
      for (let z = 0; z < height; z += 1) {
        const start = (row * grain + z) * SCATTER_MASK_TEXELS + column * grain
        chunk.set(weights.subarray(start, start + width), z * width)
      }
      chunks.push({ column, row, payload: packDeltas(chunk) })
    }
  }
  return { chunks }
}
