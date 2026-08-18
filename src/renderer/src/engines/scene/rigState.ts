/**
 * What a loaded model IS, as far as animating it goes.
 *
 * Read off the object graph and nothing else. An asset's own 3D metadata was measured wrong on
 * 2026-08-17 — `hasSkeleton: false` on files carrying 22, 39 and 52 bones, `boneCount: null` on
 * all three, `size` off by two orders of magnitude — so the file is the only thing that answers.
 *
 * Pure, like `bonePicking.ts`: three runs under jsdom without a GPU, and every question here is
 * about the shape of a tree.
 */
import type { AnimationClip, Object3D } from 'three'
import { isHumanoidRole, type HumanoidRole } from '@shared/domain/humanoid'

export type RigStatus =
  /** No bones at all. This is what "make animatable" is offered on. */
  | 'staticMesh'
  /** Bones driving a mesh, none of them filling a humanoid role: hand animation only. */
  | 'skinnedMesh'
  /** Humanoid roles identified: the whole animation library applies. */
  | 'riggedCharacter'
  /** The same, and it already carries clips of its own. */
  | 'animatedCharacter'
  /** Bones and no skinned mesh. This is not a character — it is an animation asset. */
  | 'skeletonOnly'

export const RIG_STATUSES: readonly RigStatus[] = [
  'staticMesh',
  'skinnedMesh',
  'riggedCharacter',
  'animatedCharacter',
  'skeletonOnly',
]

/** One bone as the graph holds it, with the parent a rig needs and `bonesOf` never gave. */
export type SkeletonBone = {
  name: string
  /** The nearest bone above it, or `null` when it is a root of the rig. */
  parent: string | null
  /** The humanoid role its name spells, when the name spells one. */
  role?: HumanoidRole
}

export type RigState = {
  status: RigStatus
  /**
   * The NAMED bones only — an unnamed one cannot be addressed by a document, and a track pointing
   * at one would find nothing after a reload.
   */
  bones: readonly SkeletonBone[]
  /**
   * The same, by name alone. Held rather than derived because it is read through a zustand
   * selector, and an array built per call is a new snapshot every render.
   */
  boneNames: readonly string[]
  /**
   * How many bones the file holds, named or not. Apart from `bones.length` on purpose: some
   * export pipelines strip joint names, and such a rig still has a skeleton to draw.
   */
  boneCount: number
}

/** three marks its bones with a flag; `instanceof` would miss one from another three instance. */
function isBone(object: Object3D): boolean {
  return Reflect.get(object, 'isBone') === true
}

/**
 * Every named bone of a model, each with its parent.
 *
 * Deduplicated by name, and that is not tidiness: everything downstream resolves a bone through
 * `getObjectByName`, which answers exactly one object, so a second bone of the same name is a
 * bone nothing can ever address.
 */
export function skeletonBonesOf(root: Object3D): SkeletonBone[] {
  return walkBones(root).bones
}

/** One pass, two answers: what can be addressed, and what is merely there. */
function walkBones(root: Object3D): { bones: SkeletonBone[]; boneCount: number } {
  const bones: SkeletonBone[] = []
  const seen = new Set<string>()
  let boneCount = 0

  root.traverse(object => {
    if (!isBone(object)) return
    boneCount += 1
    if (!object.name || seen.has(object.name)) return

    seen.add(object.name)
    bones.push({ name: object.name, parent: nearestBoneAbove(object), ...roleOf(object.name) })
  })

  return { bones, boneCount }
}

export function rigStateOf(root: Object3D, clips: readonly AnimationClip[] = []): RigState {
  const { bones, boneCount } = walkBones(root)

  return {
    status: statusOf(root, bones, boneCount, clips.length > 0),
    bones,
    boneNames: bones.map(bone => bone.name),
    boneCount,
  }
}

function statusOf(
  root: Object3D,
  bones: readonly SkeletonBone[],
  boneCount: number,
  animated: boolean,
): RigStatus {
  if (boneCount === 0) return 'staticMesh'
  if (!root.getObjectByProperty('isSkinnedMesh', true)) return 'skeletonOnly'
  if (!bones.some(bone => bone.role)) return 'skinnedMesh'

  return animated ? 'animatedCharacter' : 'riggedCharacter'
}

function nearestBoneAbove(bone: Object3D): string | null {
  let above = bone.parent
  while (above) {
    if (isBone(above) && above.name) return above.name
    above = above.parent
  }
  return null
}

/**
 * The role a bone name spells, if it spells one exactly. Only the studio's own spelling, prefix
 * stripped — reading the provider conventions is `boneRoles.ts`, a phase of its own.
 */
function roleOf(name: string): { role?: HumanoidRole } {
  const bare = name.slice(name.lastIndexOf(':') + 1)
  return isHumanoidRole(bare) ? { role: bare } : {}
}
