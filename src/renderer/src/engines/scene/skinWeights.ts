/**
 * The port onto the skinning worker: what a rig looks like on the wire, and who is waiting.
 *
 * `bvhBuilder`'s shape — an injected `spawn`, one worker, a register of what is out, `abandon`
 * when it dies — with the two things that pattern has never carried: a request answers many
 * times, and a caller can take one back.
 */
import type { Rig, RigBone } from '@shared/domain/rig'
import type { HumanoidRole } from '@shared/domain/humanoid'
import type { Vector3 } from '@shared/domain/transform'
import { SKIN_REGIONS, type SkinRegion, type SkinRequest, type SkinResponse } from './skinMessage'
import type { SkinBinding } from './skinVertices'

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
  const waiting = new Map<number, Slot>()
  let worker: Worker | null = null
  let disposed = false
  let nextId = 0

  const abandon = (dead: Worker, reason: string): void => {
    // A late event from a worker already replaced must not take its successor down with it.
    if (worker !== dead) return

    worker.terminate()
    worker = null
    for (const slot of waiting.values()) slot.reject(new Error(reason))
    waiting.clear()
  }

  const workerOf = (): Worker => {
    if (worker) return worker

    const started = spawn()
    started.addEventListener('message', (event: MessageEvent<SkinResponse>) =>
      settle(waiting, event.data),
    )
    // The two failures no `try` inside the worker can catch.
    started.addEventListener('error', event =>
      abandon(started, `skinning worker failed: ${event.message}`),
    )
    started.addEventListener('messageerror', () =>
      abandon(started, 'skinning worker sent an unreadable answer'),
    )
    worker = started
    return started
  }

  return {
    bind: (positions, rig, watch) =>
      new Promise<SkinBinding | null>((resolve, reject) => {
        if (disposed) {
          resolve(null)
          return
        }

        const id = (nextId += 1)
        const running = workerOf()
        const request: SkinRequest = { id, ...wireOf(positions, rig) }

        // Posted before it is recorded, so a payload the structured clone cannot carry throws
        // with no slot left behind — `bvhInflight` says why this order is safe.
        running.postMessage(request, [request.position.buffer, request.segments.buffer])
        waiting.set(id, { resolve, reject, onProgress: watch?.onProgress })

        const give = (): void => {
          if (!waiting.delete(id)) return
          running.postMessage({ id, cancel: true })
          resolve(null)
        }

        watch?.signal?.addEventListener('abort', give)

        // An `abort` already fired has already been delivered, so the listener above never runs.
        // The port's contract, not an observed path: the one caller today cannot hand over an
        // abandoned signal — measured, `scene-models.test.ts` names the ordering that stops it.
        if (watch?.signal?.aborted) give()
      }),

    dispose: () => {
      disposed = true
      worker?.terminate()
      worker = null
      // Resolved, not rejected: a window closing is nobody's failure.
      for (const slot of waiting.values()) slot.resolve(null)
      waiting.clear()
    },
  }
}

type Slot = {
  resolve: (binding: SkinBinding | null) => void
  reject: (error: Error) => void
  onProgress?: (progress: number) => void
}

/**
 * A progress report leaves the slot in place; only a `done` message takes it out. That is the one
 * rule `bvhInflight` could do without, its every request answering exactly once.
 */
function settle(waiting: Map<number, Slot>, response: SkinResponse): void {
  const slot = waiting.get(response.id)
  if (!slot) return

  if (!response.done) {
    slot.onProgress?.(response.progress)
    return
  }

  waiting.delete(response.id)
  if (response.ok) slot.resolve({ skinIndex: response.skinIndex, skinWeight: response.skinWeight })
  else slot.reject(new Error(response.error))
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
    regions[index] = SKIN_REGIONS.indexOf(regionOf(bone.role))
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
