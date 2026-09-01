import { BatchedMesh, BufferGeometry, Mesh } from 'three'
import {
  acceleratedRaycast,
  computeBatchedBoundsTree,
  computeBoundsTree,
  disposeBatchedBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh'

/**
 * three-mesh-bvh reads a `boundsTree` if the mesh has one and falls back to walking triangles if
 * it has none, so patching the prototypes once is safe for every mesh in the studio — the two
 * other 3D spaces included, where no tree is ever built.
 *
 * All of them in ONE module, imported for its side effect: `BatchedMesh` overrides `raycast`,
 * so patching `Mesh.prototype` alone leaves a lot walking its whole buffer under every instance.
 * Split across two modules, whichever was imported alone was silently the slow path.
 */
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast
BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree
BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree
BatchedMesh.prototype.raycast = acceleratedRaycast
