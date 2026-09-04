import type { GeometrySimplification } from '@shared/domain/gameExport'
import { WORTH_INSTANCING } from './grouping'

export type OptimizationPolicy = {
  minInstancesPerGroup: number
  analysisChunkSize: number
  simplificationRatios: Readonly<Record<GeometrySimplification, number>>
  generatedLods: readonly { distance: number; simplificationRatio: number }[]
}

/** Every strategy threshold lives here so benchmark results can move policy without a code hunt. */
export const DEFAULT_OPTIMIZATION_POLICY: OptimizationPolicy = Object.freeze({
  minInstancesPerGroup: WORTH_INSTANCING,
  analysisChunkSize: 100,
  simplificationRatios: Object.freeze({
    off: 0,
    conservative: 0.15,
    balanced: 0.35,
    aggressive: 0.6,
  }),
  generatedLods: Object.freeze([
    Object.freeze({ distance: 18, simplificationRatio: 0.35 }),
    Object.freeze({ distance: 55, simplificationRatio: 0.65 }),
  ]),
})
