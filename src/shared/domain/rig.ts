import { isRecord } from '../guards'
import { isHumanoidRole, type HumanoidRole } from './humanoid'
import { isTransform, type Transform } from './transform'

/**
 * A skeleton the studio owns, as the document holds it.
 *
 * The hierarchy is FREE — any tree at all: a tail, wings, four legs, tentacles, phalanges. The
 * humanoid roles are optional labels put on top (see `humanoid.ts`), and they alone are what makes
 * retargeting possible. A model without them stays riggable and animatable by hand.
 *
 * This is the one place where the inside of a model does enter the document, against the rule
 * `ModelRef` states: a rig is EDITED, bone by bone, so it wants the undo the command system gives
 * for free. The skinning weights do not follow it — they are derived from mesh and rig, exactly as
 * a BVH is, and four floats per vertex have no business in a saved file.
 */
export type Rig = {
  bones: readonly RigBone[]
  /** Who produced it — to tell the user, and to replay a fit. */
  origin: RigOrigin
}

export type RigOrigin = 'local' | 'imported' | { provider: string; modelId: string }

export type RigBone = {
  /** Unique within the rig. This is the name the three `Bone` wears, and what a track addresses. */
  name: string
  /** `null` for the root. */
  parent: string | null
  /** The rest pose, in the parent's space. */
  rest: Transform
  /** The humanoid role this bone fills, when it fills one. */
  role?: HumanoidRole
}

/**
 * Why a rig cannot be held, or nothing.
 *
 * A string rather than a boolean because every caller has something to do with it: the document
 * reader drops the model, and a command refuses the edit and says which rule it broke.
 */
export type RigFault = 'empty' | 'duplicate-bone' | 'unknown-parent' | 'cycle' | 'duplicate-role'

export function rigFaultOf(bones: readonly RigBone[]): RigFault | null {
  if (bones.length === 0) return 'empty'

  const byName = new Map<string, RigBone>()
  for (const bone of bones) {
    if (byName.has(bone.name)) return 'duplicate-bone'
    byName.set(bone.name, bone)
  }

  const roles = new Set<HumanoidRole>()
  for (const bone of bones) {
    if (bone.parent !== null && !byName.has(bone.parent)) return 'unknown-parent'
    if (!bone.role) continue
    if (roles.has(bone.role)) return 'duplicate-role'
    roles.add(bone.role)
  }

  return hasCycle(bones, byName) ? 'cycle' : null
}

export function isRig(value: unknown): value is Rig {
  if (!isRecord(value) || !Array.isArray(value.bones)) return false
  if (!isRigOrigin(value.origin)) return false
  if (!value.bones.every(isRigBone)) return false

  return rigFaultOf(value.bones) === null
}

/**
 * Walks each bone up to its root, marking what is already known to reach one.
 *
 * The walk stops on a bone it has already stepped on, which is what a cycle is: without that it
 * would hang rather than answer. Marking keeps the whole pass linear.
 */
function hasCycle(bones: readonly RigBone[], byName: ReadonlyMap<string, RigBone>): boolean {
  const rooted = new Set<string>()

  for (const bone of bones) {
    const seen = new Set<string>()
    let current: RigBone | undefined = bone

    while (current && !rooted.has(current.name)) {
      if (seen.has(current.name)) return true
      seen.add(current.name)
      current = current.parent === null ? undefined : byName.get(current.parent)
    }
    for (const name of seen) rooted.add(name)
  }

  return false
}

function isRigBone(value: unknown): value is RigBone {
  if (!isRecord(value)) return false
  if (typeof value.name !== 'string' || value.name === '') return false
  if (value.parent !== null && typeof value.parent !== 'string') return false
  if (value.role !== undefined && !isHumanoidRole(value.role)) return false

  return isTransform(value.rest)
}

function isRigOrigin(value: unknown): value is RigOrigin {
  if (value === 'local' || value === 'imported') return true

  return isRecord(value) && typeof value.provider === 'string' && typeof value.modelId === 'string'
}
