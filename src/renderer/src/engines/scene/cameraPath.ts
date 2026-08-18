import { CatmullRomCurve3, Vector3 } from 'three'
import type { PathDescriptor, Vector3 as PlainVector3 } from '@shared/domain/scene'
import { clamp } from '@shared/numeric'
import { cachedOn } from '../core/cachedOn'

/**
 * The curve a rail describes, and the cache that keeps it from being rebuilt every frame.
 *
 * Keyed by the identity of the descriptor: every edit of a scene replaces the object it touches,
 * so a descriptor that is the same object is a rail whose points have not moved. `updateArcLengths`
 * runs when the curve is BUILT and never on a frame — it walks the whole curve.
 */
const curves = new WeakMap<PathDescriptor, CatmullRomCurve3>()

/** How many samples a rail is drawn with. Enough for a smooth line at the scale a studio uses. */
export const PATH_SAMPLES = 64

export function curveOf(path: PathDescriptor): CatmullRomCurve3 {
  return cachedOn(curves, path, () => {
    const curve = new CatmullRomCurve3(
      path.points.map(point => new Vector3(point.x, point.y, point.z)),
      path.closed,
      'catmullrom',
      path.tension,
    )
    // Arc lengths are what `getPointAt` reads, and what makes a travelling run at a steady speed:
    // `getPoint` is parameterised per segment, so a camera speeds up through the short ones.
    curve.updateArcLengths()
    return curve
  })
}

/** The line to draw, sampled by arc length so the points sit evenly along it. */
export function pathPoints(path: PathDescriptor, samples: number = PATH_SAMPLES): Vector3[] {
  return curveOf(path).getSpacedPoints(samples)
}

/**
 * Which stretch between two control points an abscissa falls in — what a click on the line names.
 *
 * The abscissa is measured by ARC LENGTH, as `pathPoints` samples it, and the segments are not:
 * `getUtoTmapping` is what converts one into the other, and skipping it puts the point in the
 * wrong stretch as soon as two segments differ in length.
 */
export function segmentAt(path: PathDescriptor, u: number): number {
  const spans = path.closed ? path.points.length : path.points.length - 1
  if (spans <= 0) return 0

  const curve = curveOf(path)
  // The distance is passed rather than left out: three defaults it to `u × total length`, which
  // is the same number, but its types declare the parameter required.
  const t = curve.getUtoTmapping(clamp(u, 0, 1), clamp(u, 0, 1) * curve.getLength())
  return clamp(Math.floor(t * spans), 0, spans - 1)
}

/** One control point moved. The same descriptor back when the index names none. */
export function withMovedPoint(
  path: PathDescriptor,
  index: number,
  point: PlainVector3,
): PathDescriptor {
  if (index < 0 || index >= path.points.length) return path
  return { ...path, points: path.points.map((held, at) => (at === index ? point : held)) }
}

/**
 * A control point added after that one, halfway to its neighbour — where an eye expects it.
 *
 * Halfway along the STRAIGHT line between the two, not along the curve: a point placed on the
 * curve would change nothing of the shape, which reads as a click that did nothing.
 */
export function withPointAfter(path: PathDescriptor, index: number): PathDescriptor {
  const from = path.points[index]
  // The neighbour folds back to the first point past the end, and `from` proves there is one.
  const to = path.points[index + 1] ?? path.points[0]
  if (!from || !to) return path

  const points = [...path.points]
  points.splice(index + 1, 0, {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2,
  })
  return { ...path, points }
}

/** One control point taken away. A rail never drops below two: one point is not a line. */
export function withoutPoint(path: PathDescriptor, index: number): PathDescriptor {
  if (path.points.length <= 2 || index < 0 || index >= path.points.length) return path
  return { ...path, points: path.points.filter((_, at) => at !== index) }
}
