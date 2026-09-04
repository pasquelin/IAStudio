import { HUMANOID_BODY_ROLES, type HumanoidBodyRole } from '@shared/domain/humanoid'
import type { Rig, RigBone } from '@shared/domain/rig'
import type { Vector3 } from '@shared/domain/transform'
import { rigFaultOf } from '@shared/domain/rig'
import { worldPlaces } from '../character/rigWorld'
import type { MeshSample } from './rigSnap'
import { quantile } from './quantile'
import {
  clamp01,
  distance,
  interpolate,
  landmarkOf,
  localMaximum,
  localMinimum,
  mean,
  minimumConfidence,
  nearestSection,
  normalizedHeight,
  ordered,
  progresses,
  sectionConfidence,
  sectionStep,
  sectionStepFrom,
  sizeOf,
  subtract,
  weightedCentre,
} from './adaptiveGeometricRigMath'
import type {
  RigDebugCandidate,
  RigFitConfidence,
  RigLandmark,
  RigValidationIssue,
  RigValidationReport,
  RigDebugSection,
} from './adaptiveGeometricRig'

type Axis = 'x' | 'z'
type Section = RigDebugSection & { values: readonly Vector3[] }
const MIN_POINTS = 6
const EPSILON_FACTOR = 1e-4
const SECTION_COUNT = 72
const SIDES: readonly ('Left' | 'Right')[] = ['Left', 'Right']
const ARM_ROLES: readonly HumanoidBodyRole[] = [
  'LeftUpperArm',
  'LeftLowerArm',
  'LeftHand',
  'RightUpperArm',
  'RightLowerArm',
  'RightHand',
]
const LEG_ROLES: readonly HumanoidBodyRole[] = [
  'LeftUpperLeg',
  'LeftLowerLeg',
  'LeftFoot',
  'RightUpperLeg',
  'RightLowerLeg',
  'RightFoot',
]
const TORSO_ROLES: readonly HumanoidBodyRole[] = ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck']

const PARENTS: Readonly<Record<HumanoidBodyRole, HumanoidBodyRole | null>> = {
  Hips: null,
  Spine: 'Hips',
  Chest: 'Spine',
  UpperChest: 'Chest',
  Neck: 'UpperChest',
  Head: 'Neck',
  LeftShoulder: 'UpperChest',
  LeftUpperArm: 'LeftShoulder',
  LeftLowerArm: 'LeftUpperArm',
  LeftHand: 'LeftLowerArm',
  LeftUpperLeg: 'Hips',
  LeftLowerLeg: 'LeftUpperLeg',
  LeftFoot: 'LeftLowerLeg',
  LeftToes: 'LeftFoot',
  RightShoulder: 'UpperChest',
  RightUpperArm: 'RightShoulder',
  RightLowerArm: 'RightUpperArm',
  RightHand: 'RightLowerArm',
  RightUpperLeg: 'Hips',
  RightLowerLeg: 'RightUpperLeg',
  RightFoot: 'RightLowerLeg',
  RightToes: 'RightFoot',
}

export function landmarksOf(
  sections: readonly Section[],
  bounds: MeshSample['bounds'],
  across: Axis,
  forward: Axis,
  symmetry: { centre: number; confidence: number },
): {
  landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>
  candidates: RigDebugCandidate[]
  confidence: RigFitConfidence
} {
  const layout = landmarkLayout(sections, bounds, across, symmetry.centre)
  const candidates: RigDebugCandidate[] = []
  const landmarks = new Map<HumanoidBodyRole, RigLandmark>()

  const put = (
    role: HumanoidBodyRole,
    position: Vector3,
    confidence: number,
    source: RigDebugCandidate['source'],
  ) => {
    const landmark = { position, confidence: clamp01(confidence) }
    landmarks.set(role, landmark)
    candidates.push({ role, landmark, source })
  }

  placeCore(layout, across, symmetry.centre, put)
  for (const side of SIDES) placeSide(side, layout, bounds, across, forward, symmetry.centre, put)

  const arms = mean(ARM_ROLES.map(role => landmarkOf(landmarks, role).confidence))
  const legs = mean(LEG_ROLES.map(role => landmarkOf(landmarks, role).confidence))
  const torso = mean(TORSO_ROLES.map(role => landmarkOf(landmarks, role).confidence))
  const head = landmarkOf(landmarks, 'Head').confidence
  const confidence = {
    symmetry: symmetry.confidence,
    arms,
    legs,
    torso,
    head,
    global: mean([symmetry.confidence, arms, legs, torso, head]),
  }
  return { landmarks, candidates, confidence }
}

type PutLandmark = (
  role: HumanoidBodyRole,
  position: Vector3,
  confidence: number,
  source: RigDebugCandidate['source'],
) => void

function placeCore(
  layout: ReturnType<typeof landmarkLayout>,
  across: Axis,
  centre: number,
  put: PutLandmark,
): void {
  const centreAt = (section: Section): Vector3 => {
    const point = { ...section.centre }
    point[across] = centre
    return point
  }
  put('Hips', centreAt(layout.hipsSection), sectionConfidence(layout.hipsSection), 'section')
  put('Spine', centreAt(layout.spineSection), sectionConfidence(layout.spineSection), 'section')
  put('Chest', centreAt(layout.chestSection), sectionConfidence(layout.chestSection), 'section')
  put(
    'UpperChest',
    centreAt(layout.shoulderSection),
    sectionConfidence(layout.shoulderSection),
    'section',
  )
  put(
    'Neck',
    centreAt(layout.headStart),
    minimumConfidence(layout.headStart, layout.occupied),
    'section',
  )
  put('Head', centreAt(layout.headSection), sectionConfidence(layout.headSection), 'section')
}

function placeSide(
  side: 'Left' | 'Right',
  layout: ReturnType<typeof landmarkLayout>,
  bounds: MeshSample['bounds'],
  across: Axis,
  forward: Axis,
  centre: number,
  put: PutLandmark,
): void {
  const sign = side === 'Left' ? 1 : -1
  const atSide = (section: Section, fraction: number): Vector3 => {
    const point = { ...section.centre }
    point[across] = centre + section.halfWidth * fraction * sign
    return point
  }
  const shoulder = atSide(layout.shoulderSection, 0.55)
  const hand = armPoint(layout.armSections.end, across, forward, centre, sign)
  put(`${side}Shoulder`, shoulder, sectionConfidence(layout.shoulderSection), 'symmetry')
  put(`${side}UpperArm`, interpolate(shoulder, hand, 0.16), layout.armSections.confidence, 'chain')
  put(`${side}LowerArm`, interpolate(shoulder, hand, 0.58), layout.armSections.confidence, 'chain')
  put(`${side}Hand`, hand, layout.armSections.confidence, 'chain')
  const ankle = sideCentre(layout.ankleSection, across, forward, centre, sign)
  const foot = {
    ...ankle,
    y: Math.max(bounds.min.y + sectionStep(bounds), ankle.y - sectionStep(bounds)),
  }
  const toes = { ...foot }
  toes[forward] += Math.max(layout.ankleSection.halfDepth, sectionStep(bounds))
  put(
    `${side}UpperLeg`,
    atSide(layout.hipsSection, 0.42),
    sectionConfidence(layout.hipsSection),
    'symmetry',
  )
  put(
    `${side}LowerLeg`,
    sideCentre(layout.kneeSection, across, forward, centre, sign),
    minimumConfidence(layout.kneeSection, layout.occupied),
    'chain',
  )
  put(`${side}Foot`, foot, minimumConfidence(layout.ankleSection, layout.occupied), 'chain')
  put(`${side}Toes`, toes, minimumConfidence(layout.ankleSection, layout.occupied) * 0.8, 'chain')
}

function landmarkLayout(
  sections: readonly Section[],
  bounds: MeshSample['bounds'],
  across: Axis,
  centre: number,
) {
  const dense = sections.filter(section => section.points >= MIN_POINTS)
  const occupied = dense.length > 0 ? dense : sections.filter(section => section.points > 0)
  const headStart = localMinimum(
    occupied,
    0.62,
    0.9,
    section => section.halfWidth + section.halfDepth,
  )
  const shoulderSection = localMaximum(
    occupied,
    0.45,
    normalizedHeight(headStart, bounds),
    section => section.halfWidth,
  )
  const crotch = centralTransition(occupied, bounds, across, centre)
  const hipsSection = nearestSection(occupied, crotch.height + sizeOf(bounds).y / SECTION_COUNT)
  const ankleSection = localMinimum(
    occupied,
    0.02,
    normalizedHeight(crotch, bounds) * 0.55,
    section => section.halfWidth,
  )
  const kneeSection = limbMinimum(occupied, ankleSection, crotch)
  const headSection = weightedCentre(occupied.filter(section => section.height >= headStart.height))
  const chestSection = nearestSection(occupied, shoulderSection.height - sectionStep(bounds) * 2)
  const spineSection = nearestSection(occupied, (hipsSection.height + chestSection.height) / 2)
  return {
    occupied,
    headStart,
    shoulderSection,
    hipsSection,
    ankleSection,
    kneeSection,
    headSection,
    chestSection,
    spineSection,
    armSections: armChain(occupied, shoulderSection),
  }
}

function centralTransition(
  sections: readonly Section[],
  bounds: MeshSample['bounds'],
  across: Axis,
  centre: number,
): Section {
  const candidates = sections.filter(section => {
    const height = normalizedHeight(section, bounds)
    return height >= 0.15 && height <= 0.58
  })
  const sustained = candidates.find((section, index) => {
    const next = candidates[index + 1]
    return (
      centralShare(section, across, centre) >= 0.16 &&
      !!next &&
      centralShare(next, across, centre) >= 0.16
    )
  })
  if (sustained) return sustained
  let best = candidates[0] ?? sections[0]!
  let bestGain = -Infinity
  for (let index = 1; index < candidates.length; index += 1) {
    const section = candidates[index]
    const below = candidates[index - 1]
    if (!section || !below) continue
    const central = centralShare(section, across, centre)
    const previous = centralShare(below, across, centre)
    if (central - previous > bestGain) {
      bestGain = central - previous
      best = section
    }
  }
  return best
}

function centralShare(section: Section, across: Axis, centre: number): number {
  if (section.values.length === 0 || section.halfWidth <= 0) return 0
  return (
    section.values.filter(point => Math.abs(point[across] - centre) <= section.halfWidth * 0.18)
      .length / section.values.length
  )
}

function armChain(
  sections: readonly Section[],
  shoulder: Section,
): { end: Section; confidence: number } {
  const band = sections.filter(
    section => Math.abs(section.height - shoulder.height) <= sectionStepFrom(sections) * 4,
  )
  const end = band.reduce(
    (best, section) => (section.halfWidth > best.halfWidth ? section : best),
    shoulder,
  )
  const spread = end.halfWidth / Math.max(sectionStepFrom(sections), 1e-9)
  if (spread < 4) {
    const down = sections.filter(
      section =>
        section.height < shoulder.height && section.height > shoulder.height - end.halfWidth * 2.5,
    )
    const hand = down.reduce(
      (best, section) => (section.halfWidth > best.halfWidth ? section : best),
      shoulder,
    )
    return { end: hand, confidence: clamp01(spread / 4) * sectionConfidence(hand) }
  }
  return { end, confidence: sectionConfidence(end) }
}

function armPoint(
  section: Section,
  across: Axis,
  forward: Axis,
  centre: number,
  sign: number,
): Vector3 {
  const side = section.values.filter(point => Math.sign(point[across] - centre) === sign)
  const point = { ...section.centre }
  point[across] = centre + section.halfWidth * sign
  if (side.length > 0) {
    point.y = quantile(
      side.map(candidate => candidate.y),
      0.5,
    )
    point[forward] = quantile(
      side.map(candidate => candidate[forward]),
      0.5,
    )
  }
  return point
}

function sideCentre(
  section: Section,
  across: Axis,
  forward: Axis,
  centre: number,
  sign: number,
): Vector3 {
  const side = section.values.filter(point => Math.sign(point[across] - centre) === sign)
  if (side.length === 0) {
    const point = { ...section.centre }
    point[across] = centre + section.halfWidth * 0.45 * sign
    return point
  }
  const point = { ...section.centre }
  point[across] = quantile(
    side.map(candidate => candidate[across]),
    0.5,
  )
  point[forward] = quantile(
    side.map(candidate => candidate[forward]),
    0.5,
  )
  return point
}

function limbMinimum(sections: readonly Section[], ankle: Section, hip: Section): Section {
  const candidates = sections.filter(
    section => section.height > ankle.height && section.height < hip.height,
  )
  if (candidates.length === 0) return nearestSection(sections, (ankle.height + hip.height) / 2)
  return localMinimum(candidates, 0, 1, section => section.halfWidth + section.halfDepth)
}

export function rigOf(landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>): Rig {
  const bones: RigBone[] = HUMANOID_BODY_ROLES.map(role => {
    const parent = PARENTS[role]
    const position = landmarkOf(landmarks, role).position
    const parentPosition = parent ? landmarkOf(landmarks, parent).position : null
    return {
      name: role,
      parent,
      role,
      rest: {
        position: parentPosition ? subtract(position, parentPosition) : position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    }
  })
  return { origin: 'local', bones }
}

export function validateRig(
  rig: Rig,
  bounds: MeshSample['bounds'],
  across: Axis,
): RigValidationReport {
  const issues: RigValidationIssue[] = []
  const fault = rigFaultOf(rig.bones)
  if (fault) issues.push({ code: 'invalid-hierarchy' })
  const world = worldPlaces(rig.bones)
  const epsilon = sizeOf(bounds).y * EPSILON_FACTOR
  const containmentTolerance = Math.max(epsilon, sectionStep(bounds))
  validateBones(rig, world, bounds, epsilon, containmentTolerance, issues)
  ordered(world, ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head'], issues, 'ascending')
  for (const side of SIDES) {
    ordered(world, [`${side}UpperLeg`, `${side}LowerLeg`, `${side}Foot`], issues)
    progresses(
      world,
      [`${side}Shoulder`, `${side}UpperArm`, `${side}LowerArm`, `${side}Hand`],
      issues,
    )
  }
  validateSides(world, across, issues)
  return { accepted: issues.length === 0, issues }
}

function validateBones(
  rig: Rig,
  world: ReadonlyMap<string, Vector3>,
  bounds: MeshSample['bounds'],
  epsilon: number,
  tolerance: number,
  issues: RigValidationIssue[],
): void {
  for (const bone of rig.bones) {
    const position = world.get(bone.name)
    if (!position || !Object.values(position).every(Number.isFinite)) {
      issues.push({ code: 'invalid-number', bone: bone.name })
      continue
    }
    if (bone.parent) {
      const parent = world.get(bone.parent)
      if (parent && distance(position, parent) <= epsilon)
        issues.push({ code: 'short-bone', bone: bone.name })
    }
    if (outside(position, bounds, tolerance)) issues.push({ code: 'outside-body', bone: bone.name })
  }
}

function outside(position: Vector3, bounds: MeshSample['bounds'], tolerance: number): boolean {
  return Object.keys(position).some(axis => {
    const key = axis === 'x' || axis === 'y' ? axis : 'z'
    return (
      position[key] < bounds.min[key] - tolerance || position[key] > bounds.max[key] + tolerance
    )
  })
}

function validateSides(
  world: ReadonlyMap<string, Vector3>,
  across: Axis,
  issues: RigValidationIssue[],
): void {
  for (const part of ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot']) {
    const left = world.get(`Left${part}`)
    const right = world.get(`Right${part}`)
    if (left && right && left[across] <= right[across])
      issues.push({ code: 'reversed-sides', bone: `Left${part}` })
  }
}
