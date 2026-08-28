import type { BufferGeometry } from 'three'
import { primitiveOf, type CsgGraph } from '@shared/domain/csg'
import { geometryFor } from '../scene/threeFactory'
import { bakedGeometry } from './bakedGeometry'

/**
 * The base brush AS THE RECIPE PLACES IT, which carries the matter's scale.
 *
 * ADR-25: what a cut has not produced is shown UNCUT, never missing.
 */
export function uncutGeometry(graph: CsgGraph): BufferGeometry {
  return bakedGeometry(geometryFor(primitiveOf(graph.base)), graph.base.transform)
}
