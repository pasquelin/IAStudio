/**
 * A provider's bone names, read as the humanoid roles this studio names.
 *
 * Two files of the same platform agree on nothing: Uthana spells `mixamorig:LeftUpLeg` where
 * Tripo spells `L_Thigh`, and `rigState.ts` recognises neither — it only reads the studio's own
 * spelling. This module is what makes a rig from anywhere addressable, and retargeting possible.
 *
 * Pure, and shaped from measurement rather than from documentation: the three lists it answers
 * were parsed out of the real files on 2026-08-18, hierarchy included.
 */
import {
  bodyPartOfRole,
  isHumanoidRole,
  type BodyPart,
  type HumanoidRole,
  type HumanoidSide,
} from '@shared/domain/humanoid'

/** What reading a role needs of a bone: its name, and where it hangs. */
export type NamedBone = {
  name: string
  parent: string | null
}

/**
 * Every bone whose name spells a role, by name.
 *
 * A role lands on ONE bone: two candidates are settled by depth, the higher winning. That is not
 * a tie-break for tidiness — Tripo carries `Root`, `Hip` and `Pelvis`, all three synonyms of the
 * hips, and only `Hip` has both the legs and the trunk BELOW it: `Pelvis` leads to the legs alone.
 */
export function boneRolesOf(bones: readonly NamedBone[]): Record<string, HumanoidRole> {
  const roles: Record<string, HumanoidRole> = {}
  const taken = new Set<HumanoidRole>()

  for (const bone of shallowestFirst(bones)) {
    const role = roleOfName(bone.name)
    if (!role || taken.has(role)) continue

    roles[bone.name] = role
    taken.add(role)
  }

  if (!taken.has('Neck')) nameNeckByShape(bones, roles)
  return roles
}

/**
 * The bones one half of a body drives, or `null` for the whole of it — which is not the same as
 * "every bone", and is why the two cases answer differently: nothing is filtered at all then.
 *
 * A bone that fills no role follows the NEAREST ONE ABOVE it, so a twist bone, a finger nobody
 * named and a tail all move with the limb they hang from. Anything hanging above the hips goes
 * with the legs: the root carries where the character stands, and standing is the legs' business.
 */
export function bonesDrivenBy(
  bones: readonly NamedBone[],
  part: BodyPart,
): ReadonlySet<string> | null {
  if (part === 'all') return null

  const roles = boneRolesOf(bones)
  const byName = new Map(bones.map(bone => [bone.name, bone]))
  const driven = new Set<string>()

  for (const bone of bones) {
    if (partOfBone(bone, roles, byName) === part) driven.add(bone.name)
  }
  return driven
}

function partOfBone(
  bone: NamedBone,
  roles: Readonly<Record<string, HumanoidRole>>,
  byName: ReadonlyMap<string, NamedBone>,
): 'upper' | 'lower' {
  let walked: NamedBone | undefined = bone
  // Bounded like every other walk of this tree: a rig edited in a document can hold a cycle.
  for (let step = 0; walked && step <= byName.size; step += 1) {
    const role = roles[walked.name]
    if (role) return bodyPartOfRole(role)

    walked = walked.parent === null ? undefined : byName.get(walked.parent)
  }
  return 'lower'
}

/**
 * The neck a rig never spelled: what stands alone between the trunk and the head.
 *
 * Tripo's neck is `NeckTwist01` and `NeckTwist02`, and no name table should ever hand a role to a
 * twist bone — a twist has neither the rest orientation nor the reach of the joint it smooths.
 * Read off the tree instead, and only when no bone spelled a neck, so a rig that names its own
 * keeps it. The highest of the chain is the one that gets it: it is the one the head turns on.
 */
function nameNeckByShape(bones: readonly NamedBone[], roles: Record<string, HumanoidRole>): void {
  const byName = new Map(bones.map(bone => [bone.name, bone]))
  const head = bones.find(bone => roles[bone.name] === 'Head')
  if (!head) return

  const seen = new Set<string>()
  let above = boneAbove(head, byName)
  let highest: NamedBone | undefined

  while (above && !roles[above.name] && !seen.has(above.name)) {
    seen.add(above.name)
    highest = above
    above = boneAbove(above, byName)
  }

  // `above` must have a role of its own: a chain that reaches nothing is a head hanging free, and
  // naming its parent a neck would put the role on whatever the exporter happened to leave there.
  if (highest && above) roles[highest.name] = 'Neck'
}

function boneAbove(bone: NamedBone, byName: ReadonlyMap<string, NamedBone>): NamedBone | undefined {
  return bone.parent === null ? undefined : byName.get(bone.parent)
}

/** Sorted, so that walking the list settles a contested role by height without knowing the tree. */
function shallowestFirst(bones: readonly NamedBone[]): readonly NamedBone[] {
  const byName = new Map(bones.map(bone => [bone.name, bone]))
  const depths = new Map(bones.map(bone => [bone.name, depthOf(bone, byName)]))

  return [...bones].sort((a, b) => (depths.get(a.name) ?? 0) - (depths.get(b.name) ?? 0))
}

/** Capped at the bone count: a file whose parents loop answers a number rather than hanging. */
function depthOf(bone: NamedBone, byName: ReadonlyMap<string, NamedBone>): number {
  let depth = 0
  let above = boneAbove(bone, byName)

  while (above && depth <= byName.size) {
    depth += 1
    above = boneAbove(above, byName)
  }

  return depth
}

/**
 * The role a name spells, or nothing.
 *
 * Nothing rejects a twist bone explicitly, and none is needed: `L_CalfTwist01` reduces to
 * `calftwist01`, which is a synonym of no role. A rule matching `*Twist\d*` would only restate
 * what the tables already refuse.
 */
function roleOfName(name: string): HumanoidRole | null {
  const bare = plainOf(name)
  const centre = CENTRE_ROLES[bare]
  if (centre) return centre

  for (const [prefix, side] of SIDE_PREFIXES) {
    if (!bare.startsWith(prefix)) continue

    const sided = sidedRoleOf(side, bare.slice(prefix.length))
    if (sided) return sided
  }

  return null
}

/**
 * A name reduced to letters and digits: namespace dropped, separators removed, lowercased.
 *
 * Both spellings of a namespace have to go. A colon carries it in the FILE, and `GLTFLoader`
 * DELETES that colon rather than replacing it, so the loaded scene reads `mixamorigHips` — and a
 * second armature reads `mixamorig1Hips`, whose digits would otherwise be left glued to the part.
 */
function plainOf(name: string): string {
  const bare = name.slice(name.lastIndexOf(':') + 1)
  const plain = bare.toLowerCase().replace(/[\s_.-]/g, '')
  const prefix = RIG_PREFIXES.find(candidate => plain.startsWith(candidate))

  return prefix ? plain.slice(prefix.length).replace(/^\d+/, '') : plain
}

const RIG_PREFIXES: readonly string[] = ['mixamorig', 'bip001']

/**
 * Longest first, and that ordering is what disambiguates a single letter: `leg` starts with `l`,
 * but `eg` is a synonym of nothing, so it falls through rather than becoming a left anything.
 */
const SIDE_PREFIXES: readonly (readonly [string, HumanoidSide])[] = [
  ['left', 'Left'],
  ['right', 'Right'],
  ['l', 'Left'],
  ['r', 'Right'],
]

/** No `root`: the node a file hangs its armature from is above the body, not part of it. */
const CENTRE_ROLES: Readonly<Record<string, HumanoidRole>> = {
  hips: 'Hips',
  hip: 'Hips',
  pelvis: 'Hips',
  spine: 'Spine',
  waist: 'Spine',
  spine1: 'Chest',
  spine01: 'Chest',
  chest: 'Chest',
  spine2: 'UpperChest',
  spine02: 'UpperChest',
  upperchest: 'UpperChest',
  neck: 'Neck',
  head: 'Head',
}

/** The half of a role that follows the side. Looked up whole, so `handthumb1` never matches `hand`. */
const SIDED_PARTS: Readonly<Record<string, string>> = {
  shoulder: 'Shoulder',
  clavicle: 'Shoulder',
  arm: 'UpperArm',
  upperarm: 'UpperArm',
  forearm: 'LowerArm',
  lowerarm: 'LowerArm',
  hand: 'Hand',
  upleg: 'UpperLeg',
  upperleg: 'UpperLeg',
  thigh: 'UpperLeg',
  leg: 'LowerLeg',
  lowerleg: 'LowerLeg',
  calf: 'LowerLeg',
  shin: 'LowerLeg',
  foot: 'Foot',
  toe: 'Toes',
  toes: 'Toes',
  toebase: 'Toes',
}

/** `pinky` is Mixamo's word for what glTF and VRM call the little finger. */
const FINGER_PARTS: Readonly<Record<string, string>> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  little: 'Little',
  pinky: 'Little',
}

const FINGER_JOINTS: readonly string[] = ['1', '2', '3']

function sidedRoleOf(side: HumanoidSide, rest: string): HumanoidRole | null {
  const part = SIDED_PARTS[rest]
  if (part) return roleOrNull(`${side}${part}`)

  return fingerRoleOf(side, rest)
}

/** `LeftHandThumb1` and `LeftThumb1` are the same joint; the hand in the middle is decoration. */
function fingerRoleOf(side: HumanoidSide, rest: string): HumanoidRole | null {
  const bare = rest.startsWith('hand') ? rest.slice('hand'.length) : rest

  for (const [spelling, finger] of Object.entries(FINGER_PARTS)) {
    if (!bare.startsWith(spelling)) continue

    const joint = bare.slice(spelling.length)
    if (FINGER_JOINTS.includes(joint)) return roleOrNull(`${side}${finger}${joint}`)
  }

  return null
}

/** The guard is what makes a built string a role, so no table above needs a cast to be typed. */
function roleOrNull(spelled: string): HumanoidRole | null {
  return isHumanoidRole(spelled) ? spelled : null
}
