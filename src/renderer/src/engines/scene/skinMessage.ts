/**
 * What crosses to the skinning worker and back. Its own file so both sides read the same
 * contract, on `bvhMessage`'s pattern — and it EXTENDS that pattern on two points the BVH build
 * never needed:
 *
 * - a request answers MANY times, `done` telling a progress report from the last word;
 * - a caller may take a request back, which is what makes a minute-long bind interruptible.
 *
 * Numbers only, never a three object: a geometry is not structured-cloneable, and a region is an
 * index here rather than a humanoid role so this side knows nothing of the standard.
 */

/**
 * Which part of a body a bone drives. Weighting is restricted to bones whose region agrees with
 * the vertex's, which is what keeps a hip vertex off the hand bone when the arm hangs beside it —
 * the failure this whole worker was designed around.
 */
export type SkinRegion = 'trunk' | 'head' | 'armLeft' | 'armRight' | 'legLeft' | 'legRight'

/** The order is the wire format: a region crosses as its index in this list. */
export const SKIN_REGIONS: readonly SkinRegion[] = [
  'trunk',
  'head',
  'armLeft',
  'armRight',
  'legLeft',
  'legRight',
]

/** How many bones may drive one vertex. Four, because that is what a `SkinnedMesh` reads. */
export const INFLUENCES = 4

export type SkinRequest = {
  id: number
  /** Three floats per vertex, in the mesh's own space. */
  position: Float32Array
  /** Six floats per bone — head then tail — in the same space. A bone is a SEGMENT, not a point. */
  segments: Float32Array
  /** One region index per bone, in the order the segments are spelled. */
  regions: Uint8Array
}

/** Takes a request back. The worker stops where it is and says nothing more about it. */
export type SkinCancel = { id: number; cancel: true }

export type SkinIncoming = SkinRequest | SkinCancel

export type SkinResponse =
  /** Still working. `progress` runs 0 to 1 and never reaches it — `done` is what says so. */
  | { id: number; done: false; progress: number }
  | { id: number; done: true; ok: true; skinIndex: Uint16Array; skinWeight: Float32Array }
  | { id: number; done: true; ok: false; error: string }

export function isCancel(message: SkinIncoming): message is SkinCancel {
  return 'cancel' in message
}
