import { LOD, Mesh, type BufferGeometry, type Material, type Object3D } from 'three'
import type { LossyOptimization } from '@shared/domain/gameExport'
import { DEFAULT_OPTIMIZATION_POLICY } from '@/engines/scene/optimizationPolicy'
import { createGeometrySimplifier } from './geometrySimplifier'

export type LossyGeometry = {
  build: (geometry: BufferGeometry, material: Material | Material[]) => Promise<Object3D>
  dispose: () => void
}

/** Loads and starts the costly simplifier only for an explicitly enabled geometry loss. */
export async function lossyGeometryFor(
  options: LossyOptimization | undefined,
): Promise<LossyGeometry> {
  if (!options?.generateLods && (!options || options.geometrySimplification === 'off')) {
    return { build: async (geometry, material) => new Mesh(geometry, material), dispose: () => {} }
  }

  const simplifier = await createGeometrySimplifier()
  const simplified = new WeakMap<BufferGeometry, Map<number, Promise<BufferGeometry>>>()
  const simplify = async (geometry: BufferGeometry, ratio: number): Promise<BufferGeometry> => {
    const known = simplified.get(geometry)?.get(ratio)
    if (known) return await known
    const result = simplifier.simplify(geometry, ratio)
    const byRatio = simplified.get(geometry) ?? new Map<number, Promise<BufferGeometry>>()
    byRatio.set(ratio, result)
    simplified.set(geometry, byRatio)
    return await result
  }

  return {
    build: async (geometry, material) => {
      if (options.generateLods) return await generatedLod(geometry, material, simplify)
      return new Mesh(
        await simplify(
          geometry,
          DEFAULT_OPTIMIZATION_POLICY.simplificationRatios[options.geometrySimplification],
        ),
        material,
      )
    },
    dispose: simplifier.dispose,
  }
}

/** LOD0 owns the untouched source; only farther levels are simplified. */
async function generatedLod(
  geometry: BufferGeometry,
  material: Material | Material[],
  simplify: (geometry: BufferGeometry, ratio: number) => Promise<BufferGeometry>,
): Promise<LOD> {
  const lod = new LOD()
  lod.addLevel(new Mesh(geometry, material), 0)
  for (const level of DEFAULT_OPTIMIZATION_POLICY.generatedLods) {
    lod.addLevel(
      new Mesh(await simplify(geometry, level.simplificationRatio), material),
      level.distance,
    )
  }
  return lod
}
