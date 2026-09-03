import type { HumanoidBodyRole } from '@shared/domain/humanoid'
import type { Vector3 } from '@shared/domain/transform'
import type { MeshSample } from './rigSnap'
import { quantile } from './quantile'
import type { RigLandmark, RigValidationIssue, RigDebugSection } from './adaptiveGeometricRig'

type Axis = 'x' | 'z'
type Section = RigDebugSection & { values: readonly Vector3[] }
const SECTION_COUNT = 72
export function ordered(
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

export function progresses(
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

export function localMinimum(
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

export function localMaximum(
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

export function weightedCentre(sections: readonly Section[]): Section {
  if (sections.length === 0) throw new Error('adaptive rig needs an occupied head section')
  const total = sections.reduce((sum, section) => sum + section.points, 0)
  const height = sections.reduce((sum, section) => sum + section.height * section.points, 0) / total
  return nearestSection(sections, height)
}

export function nearestSection(sections: readonly Section[], height: number): Section {
  if (sections.length === 0) throw new Error('adaptive rig needs occupied sections')
  return sections.reduce((best, section) =>
    Math.abs(section.height - height) < Math.abs(best.height - height) ? section : best,
  )
}

export function minimumConfidence(section: Section, sections: readonly Section[]): number {
  const index = sections.indexOf(section)
  const before = sections[Math.max(0, index - 2)] ?? section
  const after = sections[Math.min(sections.length - 1, index + 2)] ?? section
  const own = section.halfWidth + section.halfDepth
  const around = (before.halfWidth + before.halfDepth + after.halfWidth + after.halfDepth) / 2
  return sectionConfidence(section) * clamp01(0.5 + (around - own) / Math.max(around, 1e-9))
}

export function sectionConfidence(section: Section): number {
  return clamp01(section.points / 48)
}

export function normalizedHeight(section: Section, bounds: MeshSample['bounds']): number {
  return (section.height - bounds.min.y) / sizeOf(bounds).y
}

export function sectionStep(bounds: MeshSample['bounds']): number {
  return sizeOf(bounds).y / SECTION_COUNT
}

export function sectionStepFrom(sections: readonly Section[]): number {
  return sections.length > 1 ? Math.abs((sections[1]?.height ?? 0) - (sections[0]?.height ?? 0)) : 0
}

export function robustRadius(values: readonly number[], centre: number): number {
  return quantile(
    values.map(value => Math.abs(value - centre)),
    0.9,
  )
}

export function sizeOf(bounds: MeshSample['bounds']): Vector3 {
  return subtract(bounds.max, bounds.min)
}

export function centreOf(bounds: MeshSample['bounds']): Vector3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
}

export function axisVector(axis: Axis, sign: number): Vector3 {
  return { x: axis === 'x' ? sign : 0, y: 0, z: axis === 'z' ? sign : 0 }
}

export function subtract(left: Vector3, right: Vector3): Vector3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

export function distance(left: Vector3, right: Vector3): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

export function interpolate(from: Vector3, to: Vector3, fraction: number): Vector3 {
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  }
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function landmarkOf(
  landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>,
  role: HumanoidBodyRole,
): RigLandmark {
  const landmark = landmarks.get(role)
  if (!landmark) throw new Error(`adaptive rig placed no landmark for ${role}`)
  return landmark
}
