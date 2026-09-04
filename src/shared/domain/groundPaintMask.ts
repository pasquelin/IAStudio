import type { GroundPaint } from './groundPaint'
import { packDeltas, type ReliefSculpt } from './relief'

export function scatterMaskFromGroundPaint(paint: GroundPaint, grain: number): ReliefSculpt {
  const chunks: ReliefSculpt['chunks'][number][] = []
  for (let row = 0; row < Math.ceil(paint.height / grain); row += 1) {
    for (let column = 0; column < Math.ceil(paint.width / grain); column += 1) {
      const width = Math.min(grain, paint.width - column * grain)
      const height = Math.min(grain, paint.height - row * grain)
      const weights = new Float32Array(width * height)
      for (let z = 0; z < height; z += 1) {
        for (let x = 0; x < width; x += 1) {
          const source = ((row * grain + z) * paint.width + column * grain + x) * 4
          const green = paint.pixels[source + 1] ?? 0
          const alpha = paint.pixels[source + 3] ?? 0
          weights[z * width + x] = (green / 255) * (alpha / 255)
        }
      }
      chunks.push({ column, row, payload: packDeltas(weights) })
    }
  }
  return { chunks }
}
