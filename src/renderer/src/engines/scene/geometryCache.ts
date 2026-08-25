import type { BufferGeometry } from 'three'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import { stableKey } from '@shared/hash'
import { tiledGeometry } from './threeSync'

export type GeometryCache = {
  /**
   * The shape a descriptor names, built once however many nodes wear it. Take one reference per
   * holder: the count is what says when the buffers can go.
   */
  acquire: (descriptor: GeometryDescriptor, tilesPerMetre: number) => BufferGeometry
  /** Gives a reference back. The geometry is disposed once the last one goes. */
  release: (geometry: BufferGeometry) => void
  /**
   * Whether this geometry is one the cache lends out. A holder must NEVER dispose one: the same
   * buffers are drawn by every node of the same shape, and freeing them under a neighbour is a
   * scene that empties with every gate green.
   */
  owns: (geometry: BufferGeometry) => boolean
  /** The engine is going away, and every shape it lent with it. */
  dispose: () => void
}

/**
 * One `BufferGeometry` per distinct shape, shared by every node that wears it.
 *
 * Built per node, ten thousand copies of one shape were ten thousand uploads: 778.7 ms and
 * 226 MB for a 32×16 sphere, 81.5 ms and 8 MB for a cube, measured on this Mac. Shared, the same
 * ten thousand cost 8.4 ms and 23 KB, and the GPU holds ONE geometry for two thousand nodes
 * against two thousand. What is left is the key: 8 ms of `stableKey`, the same for either shape.
 *
 * Nothing about a primitive belongs to the node wearing it — the transform is on the mesh — so
 * they were ten thousand spellings of the same buffers.
 *
 * Synchronous, so `createRefCache` does not fit: that one exists for the race a load in flight
 * opens, and a mesh needs its shape on the turn it is built.
 *
 * **One thing a holder writes on what it borrows**: an occlusion map gives the shape a second UV
 * set, so every node wearing it carries one. It is a copy of the first set, so it changes nothing
 * they draw — but it is the only mutation that reaches a shared shape, and the only one allowed.
 */
export function createGeometryCache(): GeometryCache {
  const held = new Map<string, { geometry: BufferGeometry; references: number }>()
  const keys = new WeakMap<BufferGeometry, string>()

  const drop = (key: string, geometry: BufferGeometry): void => {
    held.delete(key)
    // Forgotten as well as freed, so `owns` stops answering for buffers that are gone.
    keys.delete(geometry)
    geometry.dispose()
  }

  return {
    acquire: (descriptor, tilesPerMetre) => {
      const key = stableKey([descriptor, tilesPerMetre])
      const entry = held.get(key)
      if (entry) {
        entry.references += 1
        return entry.geometry
      }

      const geometry = tiledGeometry(descriptor, tilesPerMetre)
      keys.set(geometry, key)
      held.set(key, { geometry, references: 1 })
      return geometry
    },

    release: geometry => {
      const key = keys.get(geometry)
      if (key === undefined) return

      const entry = held.get(key)
      if (!entry) return

      // Never on a geometry the cache has already dropped: its key outlives it, and a second
      // release would land the decrement on the entry since built for the same descriptor —
      // disposing a shape other meshes are wearing.
      if (entry.geometry !== geometry) return

      entry.references -= 1
      if (entry.references > 0) return
      drop(key, entry.geometry)
    },

    owns: geometry => keys.has(geometry),

    dispose: () => {
      for (const [key, entry] of [...held]) drop(key, entry.geometry)
    },
  }
}
