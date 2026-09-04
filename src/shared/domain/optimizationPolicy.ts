import type { GeometrySimplification, TextureCompression, TextureReduction } from './gameExport'

export type OptimizationPolicy = {
  minInstancesPerGroup: number
  analysisChunkSize: number
  simplificationRatios: Readonly<Record<GeometrySimplification, number>>
  lodDistanceMultipliers: readonly number[]
  lodSimplificationRatios: readonly number[]
  jpegQuality: Readonly<Record<Exclude<TextureCompression, 'off'>, number>>
  textureScale: Readonly<Record<TextureReduction, number>>
}

/** All strategy thresholds share one contract so benchmarks can move them without a code hunt. */
export const DEFAULT_OPTIMIZATION_POLICY: OptimizationPolicy = Object.freeze({
  minInstancesPerGroup: 16,
  analysisChunkSize: 100,
  simplificationRatios: Object.freeze({
    off: 0,
    conservative: 0.15,
    balanced: 0.35,
    aggressive: 0.6,
  }),
  lodDistanceMultipliers: Object.freeze([12, 36]),
  lodSimplificationRatios: Object.freeze([0.35, 0.65]),
  jpegQuality: Object.freeze({ conservative: 88, balanced: 75, aggressive: 55 }),
  textureScale: Object.freeze({ off: 1, half: 0.5, quarter: 0.25 }),
})
