/**
 * The three provider skeletons, as their real files spell them.
 *
 * Parsed out of the GLB files on 2026-08-18 — names AND hierarchy, because a role is settled by
 * height and a neck is read off the tree. The files weigh 4 to 39 MB and stay out of the repo;
 * these lists are the measurement that entered it.
 */
import type { NamedBone } from './boneRoles'

type Pair = readonly [name: string, parent: string | null]

function bonesOf(pairs: readonly Pair[]): readonly NamedBone[] {
  return pairs.map(([name, parent]) => ({ name, parent }))
}

/** Uthana writes every name under the Mixamo namespace, parents included. */
function mixamoBonesOf(pairs: readonly Pair[]): readonly NamedBone[] {
  return pairs.map(([name, parent]) => ({
    name: `mixamorig:${name}`,
    parent: parent === null ? null : `mixamorig:${parent}`,
  }))
}

/**
 * `model_uthana-character-rigging`, asset `asset_tkikaENX9htvFatxMC2ThSoB` — 22 bones, no
 * animation. The hands are LEAVES: Uthana's rigger stops at the wrists.
 */
export const UTHANA_RIG_BONES: readonly NamedBone[] = mixamoBonesOf([
  ['Hips', null],
  ['Spine', 'Hips'],
  ['Spine1', 'Spine'],
  ['Spine2', 'Spine1'],
  ['Neck', 'Spine2'],
  ['Head', 'Neck'],
  ['LeftShoulder', 'Spine2'],
  ['LeftArm', 'LeftShoulder'],
  ['LeftForeArm', 'LeftArm'],
  ['LeftHand', 'LeftForeArm'],
  ['RightShoulder', 'Spine2'],
  ['RightArm', 'RightShoulder'],
  ['RightForeArm', 'RightArm'],
  ['RightHand', 'RightForeArm'],
  ['LeftUpLeg', 'Hips'],
  ['LeftLeg', 'LeftUpLeg'],
  ['LeftFoot', 'LeftLeg'],
  ['LeftToeBase', 'LeftFoot'],
  ['RightUpLeg', 'Hips'],
  ['RightLeg', 'RightUpLeg'],
  ['RightFoot', 'RightLeg'],
  ['RightToeBase', 'RightFoot'],
])

/** The five fingers of one hand, three joints each, as Mixamo names them. */
function fingerPairs(side: 'Left' | 'Right'): readonly Pair[] {
  return ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap(finger =>
    [1, 2, 3].map((joint): Pair => [
      `${side}Hand${finger}${joint}`,
      joint === 1 ? `${side}Hand` : `${side}Hand${finger}${joint - 1}`,
    ]),
  )
}

/**
 * `model_uthana-text-to-motion-3.0`, asset `asset_GD9rcpnMDFBo3Jtn2kmk4Nx4` — the 22 above plus
 * the 30 fingers. Its one animation carries NO `name`, and its only translation track is on
 * `mixamorig:Hips`: this is the measured case of real root motion.
 */
export const UTHANA_MOTION_BONES: readonly NamedBone[] = mixamoBonesOf([
  ['Hips', null],
  ['Spine', 'Hips'],
  ['Spine1', 'Spine'],
  ['Spine2', 'Spine1'],
  ['Neck', 'Spine2'],
  ['Head', 'Neck'],
  ['LeftShoulder', 'Spine2'],
  ['LeftArm', 'LeftShoulder'],
  ['LeftForeArm', 'LeftArm'],
  ['LeftHand', 'LeftForeArm'],
  ...fingerPairs('Left'),
  ['RightShoulder', 'Spine2'],
  ['RightArm', 'RightShoulder'],
  ['RightForeArm', 'RightArm'],
  ['RightHand', 'RightForeArm'],
  ...fingerPairs('Right'),
  ['LeftUpLeg', 'Hips'],
  ['LeftLeg', 'LeftUpLeg'],
  ['LeftFoot', 'LeftLeg'],
  ['LeftToeBase', 'LeftFoot'],
  ['RightUpLeg', 'Hips'],
  ['RightLeg', 'RightUpLeg'],
  ['RightFoot', 'RightLeg'],
  ['RightToeBase', 'RightFoot'],
])

/**
 * `model_tripo-rigging-v1`, asset `asset_kuWm1eHUXWpadGbLY9fkuzkE` — 39 bones, of which
 * EIGHTEEN are twist bones and 21 are not. The issue says fourteen and twenty-five; the file
 * says otherwise, and this list is the file.
 *
 * Three candidates for the hips — `Root`, `Hip`, `Pelvis` — and the tree settles it: `Pelvis`
 * leads to the legs alone and `Waist` to the trunk, so `Hip`, above both, is the only one with a
 * whole body under it. Its neck is `NeckTwist01`/`NeckTwist02`, which is why a neck is read off
 * the shape and never off a name.
 */
export const TRIPO_BONES: readonly NamedBone[] = bonesOf([
  ['Root', null],
  ['Hip', 'Root'],
  ['Pelvis', 'Hip'],
  ['L_Thigh', 'Pelvis'],
  ['L_Calf', 'L_Thigh'],
  ['L_Foot', 'L_Calf'],
  ['L_CalfTwist01', 'L_Calf'],
  ['L_CalfTwist02', 'L_CalfTwist01'],
  ['L_ThighTwist01', 'L_Thigh'],
  ['L_ThighTwist02', 'L_ThighTwist01'],
  ['R_Thigh', 'Pelvis'],
  ['R_ThighTwist01', 'R_Thigh'],
  ['R_ThighTwist02', 'R_ThighTwist01'],
  ['R_Calf', 'R_Thigh'],
  ['R_Foot', 'R_Calf'],
  ['R_CalfTwist01', 'R_Calf'],
  ['R_CalfTwist02', 'R_CalfTwist01'],
  ['Waist', 'Hip'],
  ['Spine01', 'Waist'],
  ['Spine02', 'Spine01'],
  ['NeckTwist01', 'Spine02'],
  ['NeckTwist02', 'NeckTwist01'],
  ['Head', 'NeckTwist02'],
  ['L_Clavicle', 'Spine02'],
  ['L_Upperarm', 'L_Clavicle'],
  ['L_Forearm', 'L_Upperarm'],
  ['L_ForearmTwist01', 'L_Forearm'],
  ['L_ForearmTwist02', 'L_ForearmTwist01'],
  ['L_Hand', 'L_Forearm'],
  ['L_UpperarmTwist01', 'L_Upperarm'],
  ['L_UpperarmTwist02', 'L_UpperarmTwist01'],
  ['R_Clavicle', 'Spine02'],
  ['R_Upperarm', 'R_Clavicle'],
  ['R_UpperarmTwist01', 'R_Upperarm'],
  ['R_UpperarmTwist02', 'R_UpperarmTwist01'],
  ['R_Forearm', 'R_Upperarm'],
  ['R_ForearmTwist01', 'R_Forearm'],
  ['R_ForearmTwist02', 'R_ForearmTwist01'],
  ['R_Hand', 'R_Forearm'],
])
