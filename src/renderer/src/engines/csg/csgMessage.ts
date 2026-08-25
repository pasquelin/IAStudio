/**
 * What crosses to the CSG worker and back. Its own file so both sides read the same contract —
 * the same reason `bvhMessage.ts` exists for the studio's other worker boundary.
 */
import type { CsgGraph } from '@shared/domain/csg'

/**
 * The graph goes over, not the meshes — the one place this boundary differs from the BVH one,
 * and for a reason: a brush is a DESCRIPTOR, so the worker builds the geometry itself from a few
 * hundred bytes. The BVH worker has to be handed buffers because its input comes from an
 * arbitrary GLB and nothing on this side can describe it.
 */
export type CsgRequest = {
  id: number
  graph: CsgGraph
}

/** The evaluated solid, as the four buffers a `BufferGeometry` is rebuilt from. */
export type CsgMesh = {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
  /** Absent when the evaluation produced no index — the caller draws it non-indexed. */
  index: Uint32Array | null
  /** What the result costs, read back by the counters without walking the buffers again. */
  triangles: number
}

/**
 * `ok` rather than a bare mesh: an evaluation that throws has to say so, or the promise it
 * answers stays open for the life of the window and the solid never leaves the register.
 */
export type CsgResponse =
  { id: number; ok: true; mesh: CsgMesh } | { id: number; ok: false; error: string }
