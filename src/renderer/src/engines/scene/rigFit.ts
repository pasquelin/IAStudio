/**
 * A humanoid skeleton fitted to a mesh, from its bounding box alone.
 *
 * Arithmetic and nothing else — no three objects, no GPU — because this is where a rig is either
 * right or visibly wrong, and it has to be held to account without a viewport.
 *
 * The body only, twenty-two bones, stopping at the wrists: a bounding box cannot say where a
 * knuckle is, and thirty finger bones dropped at a guess would capture vertices at a guess.
 */
import { HUMANOID_BODY_ROLES, type HumanoidBodyRole } from '@shared/domain/humanoid'
import type { Rig, RigBone } from '@shared/domain/rig'
import type { Vector3 } from '@shared/domain/transform'

export type Bounds = { min: Vector3; max: Vector3 }

/** Why a mesh cannot be fitted, or nothing. Named so the inspector can say which it is. */
export type RigFitFault = 'noGeometry' | 'lyingDown'

export const RIG_FIT_FAULTS: readonly RigFitFault[] = ['noGeometry', 'lyingDown']

/**
 * How tall a mesh must be before a proportion means anything. Below it every bone would land on
 * every other, and the weights would be noise.
 */
const MIN_HEIGHT = 1e-4

/**
 * Where each role sits, as a fraction of the mesh's height and half-width.
 *
 * These are the proportions of a standing adult, and they are the whole of the fit: `y` counts up
 * from the feet, `x` is signed outward from the centre, `z` forward. A model that is not roughly
 * human-shaped gets a rig that is roughly wrong — which is why the fit is a starting point the
 * skeleton editor exists to correct.
 */
type Placement = {
  role: HumanoidBodyRole
  parent: HumanoidBodyRole | null
  y: number
  x: number
  z: number
}

const SPINE: readonly Placement[] = [
  { role: 'Hips', parent: null, y: 0.53, x: 0, z: 0 },
  { role: 'Spine', parent: 'Hips', y: 0.6, x: 0, z: 0 },
  { role: 'Chest', parent: 'Spine', y: 0.68, x: 0, z: 0 },
  { role: 'UpperChest', parent: 'Chest', y: 0.76, x: 0, z: 0 },
  { role: 'Neck', parent: 'UpperChest', y: 0.86, x: 0, z: 0 },
  { role: 'Head', parent: 'Neck', y: 0.92, x: 0, z: 0 },
]

/**
 * A limb's parent is either a bone of the trunk, which has no side, or the limb part above it,
 * which takes the same side. Told apart here rather than by spelling, since `UpperChest` prefixed
 * with a side is a role that does not exist.
 */
type LimbParent = { trunk: HumanoidBodyRole } | { sided: string }

/** One side, mirrored by `x`. `Left` is the mesh's own left, which is +X looking down -Z. */
const LIMB: readonly { part: string; parent: LimbParent; y: number; x: number; z: number }[] = [
  { part: 'Shoulder', parent: { trunk: 'UpperChest' }, y: 0.82, x: 0.05, z: 0 },
  { part: 'UpperArm', parent: { sided: 'Shoulder' }, y: 0.82, x: 0.12, z: 0 },
  { part: 'LowerArm', parent: { sided: 'UpperArm' }, y: 0.63, x: 0.14, z: 0 },
  { part: 'Hand', parent: { sided: 'LowerArm' }, y: 0.45, x: 0.16, z: 0 },
  { part: 'UpperLeg', parent: { trunk: 'Hips' }, y: 0.52, x: 0.07, z: 0 },
  { part: 'LowerLeg', parent: { sided: 'UpperLeg' }, y: 0.28, x: 0.07, z: 0 },
  { part: 'Foot', parent: { sided: 'LowerLeg' }, y: 0.04, x: 0.07, z: 0 },
  { part: 'Toes', parent: { sided: 'Foot' }, y: 0.01, x: 0.07, z: 0.06 },
]

/**
 * How much wider than tall a figure may be before it is taken for one lying down.
 *
 * A T-pose — the commonest bind pose there is — spans about as wide as it stands, so requiring
 * height to WIN would refuse half the characters there are and blame the user for it. A figure
 * actually on its side is several times wider than tall, so the two do not overlap.
 */
const LYING_RATIO = 1.6

export function rigFitFaultOf(bounds: Bounds): RigFitFault | null {
  const size = sizeOf(bounds)
  if (size.y < MIN_HEIGHT || size.x <= 0 || size.z <= 0) return 'noGeometry'

  // Proportions are read off the height, so a mesh on its side would lay every bone ACROSS the
  // body. Reported rather than guessed at: standing it up is the user's call.
  return Math.max(size.x, size.z) > size.y * LYING_RATIO ? 'lyingDown' : null
}

/**
 * The rig a mesh of these bounds gets. Call `rigFitFaultOf` first — on a mesh it refuses, the
 * proportions here answer numbers nobody should pose a bone at.
 */
export function rigFit(bounds: Bounds): Rig {
  const size = sizeOf(bounds)
  const centre = { x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2 }

  const world = new Map<HumanoidBodyRole, Vector3>()
  const placed: Placement[] = [...SPINE, ...mirrored('Left'), ...mirrored('Right')]

  for (const placement of placed) {
    world.set(placement.role, {
      x: centre.x + placement.x * size.y,
      y: bounds.min.y + placement.y * size.y,
      z: centre.z + placement.z * size.y,
    })
  }

  return { origin: 'local', bones: placed.map(placement => boneOf(placement, world)) }
}

/** One arm and one leg of the given side, with `Left`/`Right` prefixed and `x` signed. */
function mirrored(side: 'Left' | 'Right'): Placement[] {
  const sign = side === 'Left' ? 1 : -1

  return LIMB.map(limb => ({
    role: roleOf(side, limb.part),
    parent: 'trunk' in limb.parent ? limb.parent.trunk : roleOf(side, limb.parent.sided),
    y: limb.y,
    x: limb.x * sign,
    z: limb.z,
  }))
}

/** Cast-free: the table's strings are role halves, and this is what makes them a role again. */
function roleOf(side: 'Left' | 'Right', part: string): HumanoidBodyRole {
  const name = `${side}${part}`
  const role = HUMANOID_BODY_ROLES.find(candidate => candidate === name)
  if (!role) throw new Error(`the limb table spells a role that does not exist: ${name}`)
  return role
}

/** A bone rests in its PARENT's space, so the parent's place is taken off before it is written. */
function boneOf(placement: Placement, world: Map<HumanoidBodyRole, Vector3>): RigBone {
  const here = world.get(placement.role)
  if (!here) throw new Error(`the fit placed no bone for ${placement.role}`)

  const parent = placement.parent === null ? null : world.get(placement.parent)

  return {
    name: placement.role,
    parent: placement.parent,
    role: placement.role,
    rest: {
      position: parent
        ? { x: here.x - parent.x, y: here.y - parent.y, z: here.z - parent.z }
        : here,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  }
}

function sizeOf(bounds: Bounds): Vector3 {
  return {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  }
}
