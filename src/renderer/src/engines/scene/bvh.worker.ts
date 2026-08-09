/// <reference lib="webworker" />
import { BufferAttribute, BufferGeometry } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { messageOf } from '@shared/guards'
import type { BvhRequest, BvhResponse } from './bvh-message'

declare const self: DedicatedWorkerGlobalScope

/**
 * Builds the tree that makes a click cheap, off the UI thread — CLAUDE.md invariant 6 names BVH
 * construction as belonging here.
 *
 * Only the buffers cross, never a three.js object: a geometry cannot be structured-cloned, and
 * the worker has no scene to put one in anyway. What comes back is the serialized tree plus the
 * index the build settled on — three-mesh-bvh reorders the triangles, so the geometry on the
 * other side has to take that index with the tree or the two would describe different meshes.
 */
self.addEventListener('message', (event: MessageEvent<BvhRequest>) => {
  const { id, position, index } = event.data

  try {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    if (index) geometry.setIndex(new BufferAttribute(index, 1))

    const bvh = new MeshBVH(geometry)
    const serialized = MeshBVH.serialize(bvh, { cloneBuffers: false })

    const settled = serialized.index
    const response: BvhResponse = {
      id,
      ok: true,
      bvh: {
        version: 1,
        roots: serialized.roots,
        // The build widens a 16-bit index when it has to; anything else it never produces.
        index: settled instanceof Uint32Array || settled instanceof Uint16Array ? settled : null,
        indirectBuffer: null,
      },
    }
    // Transferred rather than copied: a tree for a dense model is megabytes, and copying it back
    // would spend on the UI thread what the worker was there to save.
    const built = response.bvh.index
    self.postMessage(response, [...response.bvh.roots, ...(built ? [built.buffer] : [])])
  } catch (error) {
    // A build that raises — a buffer the file lied about, memory the tree could not have — must
    // answer all the same: the other side holds a promise on this id and nothing else settles it.
    const failed: BvhResponse = { id, ok: false, error: messageOf(error) }
    self.postMessage(failed)
  }
})
