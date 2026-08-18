/**
 * What is known about a skeleton the studio has already read, keyed by its shape.
 *
 * A mapping corrected by hand must never be asked for twice, and the same rig arrives under many
 * files: two exports of one Uthana character carry the same 22 bone names. The signature is what
 * recognises them as the same skeleton, so a correction made on one applies to the next.
 *
 * Nothing here reaches a disk. A profile derived from bone names alone is recomputed on every
 * load and costs nothing to keep; only a CORRECTION is worth storing, and the screen that
 * produces one does not exist yet.
 */
import { isRecord } from '../guards'
import { digest } from '../hash'
import { byCodeUnit } from '../text'
import { isHumanoidRole, type HumanoidRole } from './humanoid'
import { isTransform, type Transform } from './transform'

export type SkeletonProfile = {
  /** A fingerprint of the sorted bone names: two files of one rig answer the same. */
  signature: string
  /** Who produced it, to show it — `Uthana`, `Mixamo`, `imported`. */
  provider?: string
  /** Bone name to humanoid role. This is the map retargeting is built from. */
  roles: Readonly<Record<string, HumanoidRole>>
  /** The rest pose, needed to retarget between two skeletons that do not stand alike. */
  restPose?: Readonly<Record<string, Transform>>
}

/**
 * The fingerprint of a set of bone names.
 *
 * Sorted BY CODE UNIT, never by locale: a signature that read the machine's language would answer
 * differently on another machine, and the same rig would stop being recognised. Deduplicated
 * because a name appearing twice can only ever be addressed once.
 */
export function skeletonSignatureOf(boneNames: Iterable<string>): string {
  const sorted = [...new Set(boneNames)].sort(byCodeUnit)

  return `${sorted.length}-${digest(sorted.join('\n'))}`
}

/**
 * The profile with one bone's role set, or cleared when the role is `null`.
 *
 * Whatever bone held that role loses it in the same move, and that is not tidiness: a rig holding
 * one role twice is a `duplicate-role` fault, which the document reader and every command refuse.
 */
export function profileWithRole(
  profile: SkeletonProfile,
  boneName: string,
  role: HumanoidRole | null,
): SkeletonProfile {
  const roles = Object.fromEntries(
    Object.entries(profile.roles).filter(
      ([name, held]) => name !== boneName && (role === null || held !== role),
    ),
  )

  return { ...profile, roles: role === null ? roles : { ...roles, [boneName]: role } }
}

export function isSkeletonProfile(value: unknown): value is SkeletonProfile {
  if (!isRecord(value)) return false
  if (typeof value.signature !== 'string' || value.signature === '') return false
  if (value.provider !== undefined && typeof value.provider !== 'string') return false
  if (!isRoleMap(value.roles)) return false

  return value.restPose === undefined || isRestPose(value.restPose)
}

function isRoleMap(value: unknown): value is Record<string, HumanoidRole> {
  return isRecord(value) && Object.values(value).every(isHumanoidRole)
}

function isRestPose(value: unknown): value is Record<string, Transform> {
  return isRecord(value) && Object.values(value).every(isTransform)
}
