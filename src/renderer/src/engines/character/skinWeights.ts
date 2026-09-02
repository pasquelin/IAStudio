/**
 * The port onto the skinning worker: what a rig looks like on the wire, and who is waiting.
 *
 * `workerPort` holds the worker and the register; what is here is the wire — a request that
 * answers many times, and a caller that can take one back, neither of which `bvhBuilder` carries.
 */
import { isIkHandle, type Rig } from '@shared/domain/rig'
import {
  HUMANOID_FINGERS,
  type HumanoidFinger,
  type HumanoidRole,
  type HumanoidSide,
} from '@shared/domain/humanoid'
import type { Vector3 } from '@shared/domain/transform'
import { SKIN_REGIONS, type SkinRegion, type SkinRequest, type SkinResponse } from './skinMessage'
import type { SkinBinding } from './skinVertices'
import { createWorkerPort } from '../core/workerPort'
import { ORIGIN, worldPlaces } from './rigWorld'

export type SkinWeights = {
  /**
   * Weights a mesh against a rig. `null` means the request was taken back, or the port let go
   * while it was out — an awaited promise nobody answers never ends.
   */
  bind: (
    positions: Float32Array,
    rig: Rig,
    watch?: { onProgress?: (progress: number) => void; signal?: AbortSignal },
  ) => Promise<SkinBinding | null>
  dispose: () => void
}

export function createSkinWeights(spawn: () => Worker): SkinWeights {
  const port = createWorkerPort<SkinBinding, SkinResponse>(spawn, 'skinning', answer => ({
    skinIndex: answer.skinIndex,
    skinWeight: answer.skinWeight,
  }))

  return {
    bind: (positions, rig, watch) =>
      port.send(id => {
        const request: SkinRequest = { id, ...wireOf(positions, rig) }
        return { message: request, transfer: [request.position.buffer, request.segments.buffer] }
      }, watch),

    dispose: port.dispose,
  }
}

/**
 * How far past itself a leaf reaches, as a fraction of the bone arriving at it.
 *
 * 🛑 Measured as a POINT it never won a vertex against its parent's segment: on tripo-character
 * the hand, the head and the toes drove no skin at all, so a hand posed left its own flesh behind.
 */
const LEAF_REACH = 1

/** A rig as numbers: one segment and one region per bone, in the order the bones are spelled. */
export function wireOf(positions: Float32Array, rig: Rig): Omit<SkinRequest, 'id'> {
  const world = worldPlaces(rig.bones)
  const segments = new Float32Array(rig.bones.length * 6)
  const regions = new Uint8Array(rig.bones.length)

  rig.bones.forEach((bone, index) => {
    const head = world.get(bone.name) ?? ORIGIN
    const child = world.get(rig.bones.find(one => one.parent === bone.name)?.name ?? '')
    // A bone reaches towards its first child; a leaf carries its parent's direction on.
    const tail = child ?? leafTail(head, bone.parent === null ? null : world.get(bone.parent))

    segments.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], index * 6)
    regions[index] = SKIN_REGIONS.indexOf(isIkHandle(bone.name) ? 'handle' : regionOf(bone.role))
  })

  return { position: positions, segments, regions }
}

/** Where a childless bone ends: on past itself, along the bone that arrives at it. */
function leafTail(head: Vector3, parent: Vector3 | undefined | null): Vector3 {
  if (!parent) return head

  return {
    x: head.x + (head.x - parent.x) * LEAF_REACH,
    y: head.y + (head.y - parent.y) * LEAF_REACH,
    z: head.z + (head.z - parent.z) * LEAF_REACH,
  }
}

/**
 * Which part of the body a role belongs to. A bone filling no role is trunk — it agrees with
 * everything, which is the safe answer for a rig this studio did not build.
 */
export function regionOf(role: HumanoidRole | undefined): SkinRegion {
  if (!role) return 'trunk'
  if (role === 'Neck' || role === 'Head') return 'head'

  const side = role.startsWith('Left') ? 'Left' : role.startsWith('Right') ? 'Right' : null
  if (!side) return 'trunk'

  const part = role.slice(side.length)
  if (LEG_PARTS.some(leg => part.startsWith(leg))) return side === 'Left' ? 'legLeft' : 'legRight'

  // A finger before the arm, and never the arm alone — see `SkinRegion`.
  const finger = HUMANOID_FINGERS.find(one => part.startsWith(one))
  if (finger) return FINGER_REGIONS[finger][side]

  return side === 'Left' ? 'armLeft' : 'armRight'
}

const LEG_PARTS: readonly string[] = ['UpperLeg', 'LowerLeg', 'Foot', 'Toes']

/** Written out rather than composed: `toLowerCase` answers a `string`, which is not a region. */
const FINGER_REGIONS: Record<HumanoidFinger, Record<HumanoidSide, SkinRegion>> = {
  Thumb: { Left: 'thumbLeft', Right: 'thumbRight' },
  Index: { Left: 'indexLeft', Right: 'indexRight' },
  Middle: { Left: 'middleLeft', Right: 'middleRight' },
  Ring: { Left: 'ringLeft', Right: 'ringRight' },
  Little: { Left: 'littleLeft', Right: 'littleRight' },
}
