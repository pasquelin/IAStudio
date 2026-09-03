import { HUMANOID_BODY_ROLES, type HumanoidBodyRole } from '@shared/domain/humanoid'
import type { Rig, RigBone } from '@shared/domain/rig'
import type { Vector3 } from '@shared/domain/transform'
import { rigFaultOf } from '@shared/domain/rig'
import { worldPlaces } from '../character/rigWorld'
import type { MeshSample } from './rigSnap'
import { quantile } from './quantile'

export type RigLandmark = {
  position: Vector3
  confidence: number
}

export type RigValidationIssue = {
  code:
    | 'invalid-number'
    | 'invalid-hierarchy'
    | 'reversed-sides'
    | 'unordered-chain'
    | 'short-bone'
    | 'outside-body'
  bone?: string
}

export type RigValidationReport = {
  accepted: boolean
  issues: readonly RigValidationIssue[]
}

export type RigFitTimings = {
  preprocessing: number
  orientation: number
  symmetry: number
  spatialAnalysis: number
  landmarks: number
  optimization: number
  validation: number
  total: number
}

export type RigFitConfidence = {
  symmetry: number
  arms: number
  legs: number
  torso: number
  head: number
  global: number
}

export type RigDebugSection = {
  height: number
  centre: Vector3
  halfWidth: number
  halfDepth: number
  points: number
}

export type RigDebugCandidate = {
  role: HumanoidBodyRole
  landmark: RigLandmark
  source: 'section' | 'chain' | 'symmetry'
}

export type AdaptiveRigDebug = {
  bounds: MeshSample['bounds']
  robustBounds: MeshSample['bounds']
  axes: { vertical: Vector3; left: Vector3; forward: Vector3 }
  symmetryPlane: { origin: Vector3; normal: Vector3 }
  sections: readonly RigDebugSection[]
  candidates: readonly RigDebugCandidate[]
  landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>
}

export type AdaptiveRigResult = {
  rig: Rig
  validation: RigValidationReport
  confidence: RigFitConfidence
  timings: RigFitTimings
  debug: AdaptiveRigDebug
}

type Axis = 'x' | 'z'
type Section = RigDebugSection & { values: readonly Vector3[] }

const SECTION_COUNT = 72
const MIN_POINTS = 6
const EPSILON_FACTOR = 1e-4
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

export function adaptiveGeometricRig(sample: MeshSample, clock = now): AdaptiveRigResult {
  const started = clock()
  const points = pointsOf(sample.points)
  const preprocessed = clock()
  const robustBounds = robustBoundsOf(points, sample.bounds)
  const size = sizeOf(robustBounds)
  const across = size.x >= size.z ? 'x' : 'z'
  const forward: Axis = across === 'x' ? 'z' : 'x'
  const oriented = clock()
  const symmetry = symmetryOf(points, robustBounds, across)
  const symmetrical = clock()
  const sections = sectionsOf(points, robustBounds, across, forward)
  const analysed = clock()
  const { landmarks, candidates, confidence } = landmarksOf(
    sections,
    robustBounds,
    across,
    forward,
    symmetry,
  )
  const landmarked = clock()
  const rig = rigOf(landmarks)
  const optimized = clock()
  const validation = validateRig(rig, sample.bounds, across)
  const validated = clock()

  return {
    rig,
    validation,
    confidence,
    timings: {
      preprocessing: preprocessed - started,
      orientation: oriented - preprocessed,
      symmetry: symmetrical - oriented,
      spatialAnalysis: analysed - symmetrical,
      landmarks: landmarked - analysed,
      optimization: optimized - landmarked,
      validation: validated - optimized,
      total: validated - started,
    },
    debug: {
      bounds: sample.bounds,
      robustBounds,
      axes: {
        vertical: { x: 0, y: 1, z: 0 },
        left: axisVector(across, 1),
        forward: axisVector(forward, 1),
      },
      symmetryPlane: {
        origin: {
          x: across === 'x' ? symmetry.centre : centreOf(robustBounds).x,
          y: centreOf(robustBounds).y,
          z: across === 'z' ? symmetry.centre : centreOf(robustBounds).z,
        },
        normal: axisVector(across, 1),
      },
      sections: sections.map(({ values: _values, ...section }) => section),
      candidates,
      landmarks,
    },
  }
}

function pointsOf(values: Float32Array): Vector3[] {
  const points: Vector3[] = []
  for (let index = 0; index + 2 < values.length; index += 3) {
    const point = { x: values[index] ?? 0, y: values[index + 1] ?? 0, z: values[index + 2] ?? 0 }
    if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))
      points.push(point)
  }
  return points
}

function robustBoundsOf(
  points: readonly Vector3[],
  fallback: MeshSample['bounds'],
): MeshSample['bounds'] {
  if (points.length < MIN_POINTS) return fallback
  // One pass per axis, read by both ends: mapping again for the second quantile copied thirty
  // thousand points a second time for an answer the first copy already held.
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const zs = points.map(point => point.z)
  return {
    min: { x: quantile(xs, 0.01), y: quantile(ys, 0.005), z: quantile(zs, 0.01) },
    max: { x: quantile(xs, 0.99), y: quantile(ys, 0.995), z: quantile(zs, 0.99) },
  }
}

function symmetryOf(
  points: readonly Vector3[],
  bounds: MeshSample['bounds'],
  across: Axis,
): { centre: number; confidence: number } {
  const centre = quantile(
    points.map(point => point[across]),
    0.5,
  )
  const half = sizeOf(bounds)[across] / 2
  if (half <= 0 || points.length === 0) return { centre, confidence: 0 }
  const left = new Uint16Array(64)
  const right = new Uint16Array(64)
  for (const point of points) {
    const distance = point[across] - centre
    const bin = Math.min(left.length - 1, Math.floor((Math.abs(distance) / half) * left.length))
    const side = distance >= 0 ? left : right
    side[bin] = Math.min(65_535, (side[bin] ?? 0) + 1)
  }
  let paired = 0
  let total = 0
  for (let index = 0; index < left.length; index += 1) {
    paired += Math.min(left[index] ?? 0, right[index] ?? 0)
    total += Math.max(left[index] ?? 0, right[index] ?? 0)
  }
  return { centre, confidence: total === 0 ? 0 : paired / total }
}

function sectionsOf(
  points: readonly Vector3[],
  bounds: MeshSample['bounds'],
  across: Axis,
  forward: Axis,
): Section[] {
  const height = sizeOf(bounds).y
  const boundsCentre = centreOf(bounds)
  const buckets = Array.from({ length: SECTION_COUNT }, (): Vector3[] => [])
  for (const point of points) {
    const normalized = (point.y - bounds.min.y) / height
    const index = Math.min(SECTION_COUNT - 1, Math.max(0, Math.floor(normalized * SECTION_COUNT)))
    buckets[index]?.push(point)
  }

  return buckets.map((values, index) => {
    const heightAt = bounds.min.y + ((index + 0.5) / SECTION_COUNT) * height
    const centreAcross =
      values.length > 0
        ? quantile(
            values.map(point => point[across]),
            0.5,
          )
        : boundsCentre[across]
    const centreForward =
      values.length > 0
        ? quantile(
            values.map(point => point[forward]),
            0.5,
          )
        : boundsCentre[forward]
    const centre = { x: boundsCentre.x, y: heightAt, z: boundsCentre.z }
    centre[across] = centreAcross
    centre[forward] = centreForward
    return {
      height: heightAt,
      centre,
      halfWidth:
        values.length > 0
          ? robustRadius(
              values.map(point => point[across]),
              centreAcross,
            )
          : 0,
      halfDepth:
        values.length > 0
          ? robustRadius(
              values.map(point => point[forward]),
              centreForward,
            )
          : 0,
      points: values.length,
      values,
    }
  })
}

function landmarksOf(
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
  const crotch = centralTransition(occupied, bounds, across, symmetry.centre)
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
  const armSections = armChain(occupied, shoulderSection)
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

  const centreAt = (section: Section): Vector3 => {
    const point = { ...section.centre }
    point[across] = symmetry.centre
    return point
  }
  put('Hips', centreAt(hipsSection), sectionConfidence(hipsSection), 'section')
  put('Spine', centreAt(spineSection), sectionConfidence(spineSection), 'section')
  put('Chest', centreAt(chestSection), sectionConfidence(chestSection), 'section')
  put('UpperChest', centreAt(shoulderSection), sectionConfidence(shoulderSection), 'section')
  put('Neck', centreAt(headStart), minimumConfidence(headStart, occupied), 'section')
  put('Head', centreAt(headSection), sectionConfidence(headSection), 'section')

  for (const side of SIDES) {
    const sign = side === 'Left' ? 1 : -1
    const atSide = (section: Section, fraction: number): Vector3 => {
      const point = { ...section.centre }
      point[across] = symmetry.centre + section.halfWidth * fraction * sign
      return point
    }
    const shoulder = atSide(shoulderSection, 0.55)
    const hand = armPoint(armSections.end, across, forward, symmetry.centre, sign)
    const upperArm = interpolate(shoulder, hand, 0.16)
    const lowerArm = interpolate(shoulder, hand, 0.58)
    put(`${side}Shoulder`, shoulder, sectionConfidence(shoulderSection), 'symmetry')
    put(`${side}UpperArm`, upperArm, armSections.confidence, 'chain')
    put(`${side}LowerArm`, lowerArm, armSections.confidence, 'chain')
    put(`${side}Hand`, hand, armSections.confidence, 'chain')
    const hip = atSide(hipsSection, 0.42)
    const knee = sideCentre(kneeSection, across, forward, symmetry.centre, sign)
    const ankle = sideCentre(ankleSection, across, forward, symmetry.centre, sign)
    const foot = { ...ankle }
    foot.y = Math.max(bounds.min.y + sectionStep(bounds), ankle.y - sectionStep(bounds))
    const toes = { ...foot }
    toes[forward] += Math.max(ankleSection.halfDepth, sectionStep(bounds))
    put(`${side}UpperLeg`, hip, sectionConfidence(hipsSection), 'symmetry')
    put(`${side}LowerLeg`, knee, minimumConfidence(kneeSection, occupied), 'chain')
    put(`${side}Foot`, foot, minimumConfidence(ankleSection, occupied), 'chain')
    put(`${side}Toes`, toes, minimumConfidence(ankleSection, occupied) * 0.8, 'chain')
  }

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

function rigOf(landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>): Rig {
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

function validateRig(rig: Rig, bounds: MeshSample['bounds'], across: Axis): RigValidationReport {
  const issues: RigValidationIssue[] = []
  const fault = rigFaultOf(rig.bones)
  if (fault) issues.push({ code: 'invalid-hierarchy' })
  const world = worldPlaces(rig.bones)
  const epsilon = sizeOf(bounds).y * EPSILON_FACTOR
  const containmentTolerance = Math.max(epsilon, sectionStep(bounds))
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
    if (
      position.x < bounds.min.x - containmentTolerance ||
      position.x > bounds.max.x + containmentTolerance ||
      position.y < bounds.min.y - containmentTolerance ||
      position.y > bounds.max.y + containmentTolerance ||
      position.z < bounds.min.z - containmentTolerance ||
      position.z > bounds.max.z + containmentTolerance
    )
      issues.push({ code: 'outside-body', bone: bone.name })
  }
  ordered(world, ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head'], issues, 'ascending')
  for (const side of SIDES) {
    ordered(world, [`${side}UpperLeg`, `${side}LowerLeg`, `${side}Foot`], issues)
    progresses(
      world,
      [`${side}Shoulder`, `${side}UpperArm`, `${side}LowerArm`, `${side}Hand`],
      issues,
    )
  }
  for (const part of ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot']) {
    const left = world.get(`Left${part}`)
    const right = world.get(`Right${part}`)
    if (left && right && left[across] <= right[across])
      issues.push({ code: 'reversed-sides', bone: `Left${part}` })
  }
  return { accepted: issues.length === 0, issues }
}

function ordered(
  world: ReadonlyMap<string, Vector3>,
  names: readonly string[],
  issues: RigValidationIssue[],
  direction: 'ascending' | 'descending' = 'descending',
): void {
  for (let index = 1; index < names.length; index += 1) {
    const above = world.get(names[index - 1] ?? '')
    const below = world.get(names[index] ?? '')
    const invalid =
      above && below && (direction === 'ascending' ? above.y >= below.y : above.y <= below.y)
    if (invalid) issues.push({ code: 'unordered-chain', bone: names[index] })
  }
}

function progresses(
  world: ReadonlyMap<string, Vector3>,
  names: readonly string[],
  issues: RigValidationIssue[],
): void {
  const from = world.get(names[0] ?? '')
  const to = world.get(names.at(-1) ?? '')
  if (!from || !to) return
  let previous = -Infinity
  for (const name of names) {
    const point = world.get(name)
    if (!point) continue
    const progress = distance(from, point) / Math.max(distance(from, to), Number.EPSILON)
    if (progress <= previous) issues.push({ code: 'unordered-chain', bone: name })
    previous = progress
  }
}

function localMinimum(
  sections: readonly Section[],
  from: number,
  to: number,
  score: (section: Section) => number,
): Section {
  const start = sections[0]!
  const end = sections.at(-1)!
  const height = end.height - start.height
  const candidates = sections.filter(section => {
    const at = height <= 0 ? 0 : (section.height - start.height) / height
    return at >= from && at <= to
  })
  return candidates.reduce(
    (best, section) => (score(section) < score(best) ? section : best),
    candidates[0] ?? start,
  )
}

function localMaximum(
  sections: readonly Section[],
  from: number,
  to: number,
  score: (section: Section) => number,
): Section {
  const start = sections[0]!
  const end = sections.at(-1)!
  const height = end.height - start.height
  const candidates = sections.filter(section => {
    const at = height <= 0 ? 0 : (section.height - start.height) / height
    return at >= from && at <= to
  })
  return candidates.reduce(
    (best, section) => (score(section) > score(best) ? section : best),
    candidates[0] ?? start,
  )
}

function weightedCentre(sections: readonly Section[]): Section {
  if (sections.length === 0) throw new Error('adaptive rig needs an occupied head section')
  const total = sections.reduce((sum, section) => sum + section.points, 0)
  const height = sections.reduce((sum, section) => sum + section.height * section.points, 0) / total
  return nearestSection(sections, height)
}

function nearestSection(sections: readonly Section[], height: number): Section {
  if (sections.length === 0) throw new Error('adaptive rig needs occupied sections')
  return sections.reduce((best, section) =>
    Math.abs(section.height - height) < Math.abs(best.height - height) ? section : best,
  )
}

function minimumConfidence(section: Section, sections: readonly Section[]): number {
  const index = sections.indexOf(section)
  const before = sections[Math.max(0, index - 2)] ?? section
  const after = sections[Math.min(sections.length - 1, index + 2)] ?? section
  const own = section.halfWidth + section.halfDepth
  const around = (before.halfWidth + before.halfDepth + after.halfWidth + after.halfDepth) / 2
  return sectionConfidence(section) * clamp01(0.5 + (around - own) / Math.max(around, 1e-9))
}

function sectionConfidence(section: Section): number {
  return clamp01(section.points / 48)
}

function normalizedHeight(section: Section, bounds: MeshSample['bounds']): number {
  return (section.height - bounds.min.y) / sizeOf(bounds).y
}

function sectionStep(bounds: MeshSample['bounds']): number {
  return sizeOf(bounds).y / SECTION_COUNT
}

function sectionStepFrom(sections: readonly Section[]): number {
  return sections.length > 1 ? Math.abs((sections[1]?.height ?? 0) - (sections[0]?.height ?? 0)) : 0
}

function robustRadius(values: readonly number[], centre: number): number {
  return quantile(
    values.map(value => Math.abs(value - centre)),
    0.9,
  )
}

function sizeOf(bounds: MeshSample['bounds']): Vector3 {
  return subtract(bounds.max, bounds.min)
}

function centreOf(bounds: MeshSample['bounds']): Vector3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
}

function axisVector(axis: Axis, sign: number): Vector3 {
  return { x: axis === 'x' ? sign : 0, y: 0, z: axis === 'z' ? sign : 0 }
}

function subtract(left: Vector3, right: Vector3): Vector3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

function distance(left: Vector3, right: Vector3): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

function interpolate(from: Vector3, to: Vector3, fraction: number): Vector3 {
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function landmarkOf(
  landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>,
  role: HumanoidBodyRole,
): RigLandmark {
  const landmark = landmarks.get(role)
  if (!landmark) throw new Error(`adaptive rig placed no landmark for ${role}`)
  return landmark
}

function now(): number {
  return performance.now()
}
