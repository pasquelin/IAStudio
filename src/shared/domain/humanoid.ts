/**
 * The roles a humanoid skeleton fills, as this studio names them.
 *
 * A role is a LABEL PUT ON a bone, never the bone itself: a rig's hierarchy is free — a tail,
 * wings, four legs — and only the bones that happen to fill a humanoid role carry one. That is
 * what makes retargeting possible between two files that agree on nothing else, and what leaves a
 * non-humanoid model riggable and animatable by hand.
 *
 * The set is Mixamo's, which two of the three provider outputs measured on 2026-08-17 already
 * speak, and which importing from Mixamo requires. The names here are the studio's own and clean:
 * a file's `mixamorig:` prefix is stripped when its bones are read, never carried inside.
 */

export type HumanoidSide = 'Left' | 'Right'

/** `Little` rather than `Pinky`: the glTF and VRM standards spell it that way, Mixamo does not. */
export type HumanoidFinger = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Little'

/** Root, middle, tip. A thumb has three here like every other finger, as Mixamo rigs it. */
export type HumanoidFingerJoint = 1 | 2 | 3

/** The twenty-two of the body — everything an automatic fit can place from a bounding box. */
export type HumanoidBodyRole =
  | 'Hips'
  | 'Spine'
  | 'Chest'
  | 'UpperChest'
  | 'Neck'
  | 'Head'
  | 'LeftShoulder'
  | 'LeftUpperArm'
  | 'LeftLowerArm'
  | 'LeftHand'
  | 'RightShoulder'
  | 'RightUpperArm'
  | 'RightLowerArm'
  | 'RightHand'
  | 'LeftUpperLeg'
  | 'LeftLowerLeg'
  | 'LeftFoot'
  | 'LeftToes'
  | 'RightUpperLeg'
  | 'RightLowerLeg'
  | 'RightFoot'
  | 'RightToes'

export type HumanoidFingerRole = `${HumanoidSide}${HumanoidFinger}${HumanoidFingerJoint}`

export type HumanoidRole = HumanoidBodyRole | HumanoidFingerRole

export const HUMANOID_SIDES: readonly HumanoidSide[] = ['Left', 'Right']

export const HUMANOID_FINGERS: readonly HumanoidFinger[] = [
  'Thumb',
  'Index',
  'Middle',
  'Ring',
  'Little',
]

export const HUMANOID_FINGER_JOINTS: readonly HumanoidFingerJoint[] = [1, 2, 3]

/**
 * The body, in the order a skeleton walks: root first, then up the spine, then the limbs.
 *
 * An automatic fit places exactly these and stops at the wrists. A rigger cannot deduce phalanges
 * from a bounding box, and thirty finger bones dropped at random on a mitten hand would capture
 * vertices at random — a rig that looks complete and deforms badly is worse than one visibly
 * incomplete.
 */
export const HUMANOID_BODY_ROLES: readonly HumanoidBodyRole[] = [
  'Hips',
  'Spine',
  'Chest',
  'UpperChest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftUpperArm',
  'LeftLowerArm',
  'LeftHand',
  'RightShoulder',
  'RightUpperArm',
  'RightLowerArm',
  'RightHand',
  'LeftUpperLeg',
  'LeftLowerLeg',
  'LeftFoot',
  'LeftToes',
  'RightUpperLeg',
  'RightLowerLeg',
  'RightFoot',
  'RightToes',
]

/** Annotated rather than asserted: the return type is what makes the template a role and not a string. */
function fingerRole(
  side: HumanoidSide,
  finger: HumanoidFinger,
  joint: HumanoidFingerJoint,
): HumanoidFingerRole {
  return `${side}${finger}${joint}`
}

/**
 * The thirty of the hands, built from their three axes rather than listed.
 *
 * Written this way so the compiler carries the exhaustiveness: a finger added to `HumanoidFinger`
 * lands here on its own, where a hand-written list of thirty would silently miss three.
 */
export const HUMANOID_FINGER_ROLES: readonly HumanoidFingerRole[] = HUMANOID_SIDES.flatMap(side =>
  HUMANOID_FINGERS.flatMap(finger =>
    HUMANOID_FINGER_JOINTS.map(joint => fingerRole(side, finger, joint)),
  ),
)

/** All fifty-two. This is the list the translation bundles are walked against. */
export const HUMANOID_ROLES: readonly HumanoidRole[] = [
  ...HUMANOID_BODY_ROLES,
  ...HUMANOID_FINGER_ROLES,
]

const ROLE_SET: ReadonlySet<string> = new Set(HUMANOID_ROLES)

export function isHumanoidRole(value: unknown): value is HumanoidRole {
  return typeof value === 'string' && ROLE_SET.has(value)
}
