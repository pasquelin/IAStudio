import { InstancedMesh, Object3D, type BufferGeometry, type Material } from 'three'
import { applyTransform } from './pivot'
import type { BakedInstance } from './sceneState'

export function bakedInstancesOf(
  geometry: BufferGeometry,
  material: Material,
  instances: readonly BakedInstance[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, instances.length)
  const placement = new Object3D()
  for (const [slot, instance] of instances.entries()) {
    applyTransform(placement, instance.transform)
    placement.updateMatrix()
    mesh.setMatrixAt(slot, placement.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.userData['sourceIds'] = instances.map(instance => instance.sourceId)
  mesh.computeBoundingSphere()
  return mesh
}

export function bakedSourceIdOf(mesh: InstancedMesh, slot: number): string | null {
  const sourceIds: unknown = mesh.userData['sourceIds']
  return Array.isArray(sourceIds) && typeof sourceIds[slot] === 'string' ? sourceIds[slot] : null
}
