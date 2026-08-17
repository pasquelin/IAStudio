/**
 * What crosses to the BVH worker and back. Its own file so both sides read the same contract —
 * the same reason `shared/ipc.ts` exists for the other boundary of the studio.
 */

export type BvhIndex = Uint16Array | Uint32Array

export type BvhRequest = {
  id: number
  position: Float32Array
  /** Absent on a non-indexed geometry; the build makes one, and hands it back. */
  index: BvhIndex | null
}

/**
 * The tree as three-mesh-bvh writes it down. Spelled out here rather than imported: the library
 * types it without its own `version` field, which `deserialize` nonetheless reads.
 */
export type SerializedBvh = {
  version: number
  /** One buffer per root. */
  roots: ArrayBuffer[]
  /** The index the build settled on — the triangles were reordered around it. */
  index: BvhIndex | null
  indirectBuffer: null
}

/**
 * `ok` rather than a bare tree: a build that throws has to say so, or the promise it answers stays
 * open for the life of the window and the geometry never leaves the builder's `building` map. Same
 * shape as `catalog-protocol.ts`, the studio's other worker boundary.
 */
export type BvhResponse =
  { id: number; ok: true; bvh: SerializedBvh } | { id: number; ok: false; error: string }
