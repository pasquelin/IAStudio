import type { HumanoidBodyRole } from '@shared/domain/humanoid'
import type { Rig } from '@shared/domain/rig'
import type { Vector3 } from '@shared/domain/transform'
import type { MeshSample } from './rigSnap'
import { quantile } from './quantile'
import { landmarksOf, rigOf, validateRig } from './adaptiveGeometricRigAnalysis'
import { axisVector, centreOf, robustRadius, sizeOf } from './adaptiveGeometricRigMath'

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
export function adaptiveGeometricRig(sample: MeshSample, clock = now): AdaptiveRigResult {
  const started = clock(),
    points = pointsOf(sample.points)
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
  return resultOf(
    sample,
    robustBounds,
    across,
    forward,
    symmetry,
    sections,
    candidates,
    landmarks,
    confidence,
    rig,
    validation,
    {
      started,
      preprocessed,
      oriented,
      symmetrical,
      analysed,
      landmarked,
      optimized,
      validated,
    },
  )
}

function resultOf(
  sample: MeshSample,
  robustBounds: MeshSample['bounds'],
  across: Axis,
  forward: Axis,
  symmetry: { centre: number; confidence: number },
  sections: readonly Section[],
  candidates: readonly RigDebugCandidate[],
  landmarks: ReadonlyMap<HumanoidBodyRole, RigLandmark>,
  confidence: RigFitConfidence,
  rig: Rig,
  validation: RigValidationReport,
  time: {
    started: number
    preprocessed: number
    oriented: number
    symmetrical: number
    analysed: number
    landmarked: number
    optimized: number
    validated: number
  },
): AdaptiveRigResult {
  return {
    rig,
    validation,
    confidence,
    timings: timingsOf(time),
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

function timingsOf(time: Parameters<typeof resultOf>[11]): RigFitTimings {
  return {
    preprocessing: time.preprocessed - time.started,
    orientation: time.oriented - time.preprocessed,
    symmetry: time.symmetrical - time.oriented,
    spatialAnalysis: time.analysed - time.symmetrical,
    landmarks: time.landmarked - time.analysed,
    optimization: time.optimized - time.landmarked,
    validation: time.validated - time.optimized,
    total: time.validated - time.started,
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

function now(): number {
  return performance.now()
}
