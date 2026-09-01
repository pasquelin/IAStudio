/**
 * The port onto the skinning worker: what a rig looks like on the wire, and who is waiting.
 *
 * `workerPort` holds the worker and the register; what is here is the wire — a request that
 * answers many times, and a caller that can take one back, neither of which `bvhBuilder` carries.
 */
import { isIkHandle, type Rig, type RigBone } from '@shared/domain/rig'
import type { HumanoidRole } from '@shared/domain/humanoid'
import type { Vector3 } from '@shared/domain/transform'
import { SKIN_REGIONS, type SkinRegion, type SkinRequest, type SkinResponse } from './skinMessage'
import type { SkinBinding } from './skinVertices'
import { createWorkerPort } from '../core/workerPort'

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
      new Promise<SkinBinding | null>((resolve, reject) => {
        if (port.isGone()) {
          resolve(null)
          return
        }

        const id = port.claim()
        const running = port.running()
        const request: SkinRequest = { id, ...wireOf(positions, rig) }

        // Posted before it is recorded, so a payload the structured clone cannot carry throws
        // with no slot left behind — `bvhInflight` says why this order is safe.
        running.postMessage(request, [request.position.buffer, request.segments.buffer])

        const give = (): void => {
          if (!port.forget(id)) return
          watch?.signal?.removeEventListener('abort', give)
          running.postMessage({ id, cancel: true })
          resolve(null)
        }

        // Wrapped rather than dropped at each exit: a request leaves the register by four paths,
        // and one that forgot its listener would leak with nothing to say so.
        const settled =
          <T>(hand: (value: T) => void) =>
          (value: T): void => {
            watch?.signal?.removeEventListener('abort', give)
            hand(value)
          }

        port.record(id, {
          resolve: settled(resolve),
          reject: settled(reject),
          onProgress: watch?.onProgress,
        })

        // Abandoned before it was even asked: an `abort` already delivered never calls the
        // listener below, which would outlive the request on a signal one caller keeps for a
        // whole model. A port contract — `scene-models.test.ts` measures why nothing reaches it.
        if (watch?.signal?.aborted) {
          give()
          return
        }

        watch?.signal?.addEventListener('abort', give)
      }),

    dispose: port.dispose,
  }
}

/** A rig as numbers: one segment and one region per bone, in the order the bones are spelled. */
export function wireOf(positions: Float32Array, rig: Rig): Omit<SkinRequest, 'id'> {
  const world = worldPlaces(rig.bones)
  const segments = new Float32Array(rig.bones.length * 6)
  const regions = new Uint8Array(rig.bones.length)

  rig.bones.forEach((bone, index) => {
    const head = world.get(bone.name) ?? ORIGIN
    // A bone reaches towards its first child; a leaf has none and measures as a point.
    const tail = world.get(rig.bones.find(child => child.parent === bone.name)?.name ?? '') ?? head

    segments.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], index * 6)
    regions[index] = SKIN_REGIONS.indexOf(isIkHandle(bone.name) ? 'handle' : regionOf(bone.role))
  })

  return { position: positions, segments, regions }
}

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }

/** Rest poses are written in a parent's space; the distances are measured in the mesh's. */
function worldPlaces(bones: readonly RigBone[]): Map<string, Vector3> {
  const byName = new Map(bones.map(bone => [bone.name, bone]))
  const world = new Map<string, Vector3>()

  const place = (bone: RigBone): Vector3 => {
    const known = world.get(bone.name)
    if (known) return known

    const parent = bone.parent === null ? null : byName.get(bone.parent)
    const above = parent ? place(parent) : ORIGIN
    const here = {
      x: above.x + bone.rest.position.x,
      y: above.y + bone.rest.position.y,
      z: above.z + bone.rest.position.z,
    }
    world.set(bone.name, here)
    return here
  }

  for (const bone of bones) place(bone)
  return world
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

  return side === 'Left' ? 'armLeft' : 'armRight'
}

const LEG_PARTS: readonly string[] = ['UpperLeg', 'LowerLeg', 'Foot', 'Toes']
