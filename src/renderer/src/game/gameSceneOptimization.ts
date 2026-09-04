import {
  InstancedMesh,
  LOD,
  Mesh,
  Object3D,
  type BufferGeometry,
  type MeshStandardMaterial,
} from 'three'
import type { CompiledModelMesh } from '@shared/domain/gameExport'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import type { Transform } from '@shared/domain/transform'
import type { BakedInstance } from '@/engines/scene/sceneState'
import { bakedInstancesOf } from '@/engines/scene/bakedInstances'
import { geometryOfCompiledMesh } from '@/engines/scene/compiledGeometry'
import { applyTransform } from '@/engines/scene/pivot'

const BASE_LOD_DISTANCES = new WeakMap<LOD, readonly number[]>()

export function applyCompiledModel(
  root: Object3D,
  plan: readonly CompiledModelMesh[] | undefined,
  owned: Set<BufferGeometry>,
  modelMeshes: WeakSet<Mesh>,
): Object3D {
  if (!plan) return root
  const meshes = meshesIn(root)
  let optimized = root
  for (const item of plan) {
    const mesh = meshes[item.meshIndex]
    if (!mesh) continue
    optimized = applyCompiledMesh(optimized, mesh, item, owned, modelMeshes)
  }
  return optimized
}

function meshesIn(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse(object => {
    if (object instanceof Mesh) meshes.push(object)
  })
  return meshes
}

function applyCompiledMesh(
  root: Object3D,
  mesh: Mesh,
  item: CompiledModelMesh,
  owned: Set<BufferGeometry>,
  modelMeshes: WeakSet<Mesh>,
): Object3D {
  if (item.geometry) {
    const geometry = geometryOfCompiledMesh(item.geometry)
    mesh.geometry = geometry
    owned.add(geometry)
    return root
  }
  if (!item.lodMeshes?.length) return root
  const replacesRoot = mesh.parent === null
  const lod = createModelLod(mesh)
  for (const [index, compiled] of item.lodMeshes.entries()) {
    addCompiledLevel(lod, mesh, compiled, index, owned, modelMeshes)
  }
  rememberLodDistances(lod)
  return replacesRoot ? lod : root
}

function createModelLod(mesh: Mesh): LOD {
  const parent = mesh.parent
  const lod = new LOD()
  lod.name = mesh.name
  lod.position.copy(mesh.position)
  lod.quaternion.copy(mesh.quaternion)
  lod.scale.copy(mesh.scale)
  mesh.position.set(0, 0, 0)
  mesh.quaternion.identity()
  mesh.scale.set(1, 1, 1)
  if (parent) parent.add(lod)
  lod.addLevel(mesh, 0)
  mesh.geometry.computeBoundingSphere()
  return lod
}

function addCompiledLevel(
  lod: LOD,
  source: Mesh,
  compiled: NonNullable<CompiledModelMesh['lodMeshes']>[number],
  index: number,
  owned: Set<BufferGeometry>,
  modelMeshes: WeakSet<Mesh>,
): void {
  const geometry = geometryOfCompiledMesh(compiled)
  owned.add(geometry)
  const level = new Mesh(geometry, source.material)
  modelMeshes.add(level)
  level.castShadow = source.castShadow
  level.receiveShadow = source.receiveShadow
  const radius = source.geometry.boundingSphere?.radius ?? 1
  lod.addLevel(level, radius * (DEFAULT_OPTIMIZATION_POLICY.lodDistanceMultipliers[index] ?? 1))
}

export function renderedGeometry(
  geometries: readonly BufferGeometry[],
  material: MeshStandardMaterial,
  baked?: readonly BakedInstance[],
): Object3D {
  const levels = geometries.map(geometry =>
    baked ? bakedInstancesOf(geometry, material, baked) : new Mesh(geometry, material),
  )
  if (levels.length === 1) return levels[0] ?? new Object3D()
  const lod = new LOD()
  const radius = radiusOf(levels[0], geometries[0])
  levels.forEach((level, index) => lod.addLevel(level, distanceOf(radius, index)))
  rememberLodDistances(lod)
  return lod
}

function radiusOf(level: Object3D | undefined, geometry: BufferGeometry | undefined): number {
  if (level instanceof InstancedMesh) {
    level.computeBoundingSphere()
    return level.boundingSphere?.radius ?? 1
  }
  geometry?.computeBoundingSphere()
  return geometry?.boundingSphere?.radius ?? 1
}

function distanceOf(radius: number, index: number): number {
  return index === 0
    ? 0
    : radius * (DEFAULT_OPTIMIZATION_POLICY.lodDistanceMultipliers[index - 1] ?? 1)
}

function rememberLodDistances(lod: LOD): void {
  BASE_LOD_DISTANCES.set(
    lod,
    lod.levels.map(level => level.distance),
  )
}

export function applyGameTransform(object: Object3D, transform: Transform): void {
  applyTransform(object, transform)
  const scale = Math.max(...Object.values(transform.scale).map(Math.abs))
  object.traverse(child => scaleLod(child, scale))
}

function scaleLod(object: Object3D, scale: number): void {
  if (!(object instanceof LOD)) return
  const distances = BASE_LOD_DISTANCES.get(object)
  if (!distances) return
  object.levels.forEach((level, index) => {
    level.distance = (distances[index] ?? level.distance) * scale
  })
}

export function instancedMeshesIn(object: Object3D): readonly InstancedMesh[] {
  const meshes: InstancedMesh[] = []
  object.traverse(child => {
    if (child instanceof InstancedMesh) meshes.push(child)
  })
  return meshes
}
