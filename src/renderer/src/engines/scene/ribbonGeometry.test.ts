import { Box3, Vector3, type BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import type { Vector3 as PlainVector3 } from '@shared/domain/scene'
import { ribbonGeometry } from './ribbonGeometry'

const at = (x: number, z: number): PlainVector3 => ({ x, y: 0, z })

const band = (points: readonly PlainVector3[], over: { width?: number; closed?: boolean } = {}) =>
  ribbonGeometry({
    kind: 'ribbon',
    points,
    width: over.width ?? 2,
    height: 0.5,
    closed: over.closed ?? false,
  })

const cornersOf = (geometry: ReturnType<typeof band>): Vector3[] => {
  const position = geometry.getAttribute('position') as BufferAttribute
  return Array.from(
    { length: position.count },
    (_, at) => new Vector3(position.getX(at), position.getY(at), position.getZ(at)),
  )
}

/** How far a point sits from a segment — what says whether a corner stands outside the band. */
function distanceToSegment(point: Vector3, from: PlainVector3, to: PlainVector3): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = dx * dx + dz * dz
  const along =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / length))
  return Math.hypot(point.x - (from.x + dx * along), point.z - (from.z + dz * along))
}

describe('a ribbon', () => {
  /**
   * 🛑 A run of boxes is stretched at both ends to close the wedge a turn leaves, so it reaches
   * past the points it was given. A band swept along them stops exactly where they do.
   */
  it('reaches no further than the run it was given', () => {
    const size = new Box3()
      .setFromPoints(cornersOf(band([at(0, 5), at(0, -5)])))
      .getSize(new Vector3())

    expect(size.z).toBeCloseTo(10, 5)
    expect(size.x).toBeCloseTo(2, 5)
    expect(size.y).toBeCloseTo(0.5, 5)
  })

  /**
   * 🛑 The defect this shape exists for: two boxes overlapped at a right angle leave four corners
   * standing outside the band, and their union keeps them — which reads as a staircase.
   */
  it('stands no corner outside the band at a turn', () => {
    const run = [at(-10, 0), at(0, 0), at(0, -10)]
    const outside = cornersOf(band(run)).filter(corner => {
      const nearest = Math.min(
        distanceToSegment(corner, run[0]!, run[1]!),
        distanceToSegment(corner, run[1]!, run[2]!),
      )
      // A right angle mitres to half the width times √2, and nothing may sit past it.
      return nearest > Math.SQRT2 + 1e-6
    })

    expect(outside).toEqual([])
  })

  /**
   * 🛑 The other half of a mitre, and the reason boxes were overlapped in the first place: cut
   * square, two sections meeting at an angle leave a WEDGE of nothing on the outside of the turn.
   */
  it('fills the outside of a turn right up to the mitre', () => {
    const corner = at(0, 0)
    // The joint's OWN corners: the far ends of the run stand ten metres off and say nothing here.
    const reach = cornersOf(band([at(-10, 0), corner, at(0, -10)]))
      .map(one => Math.hypot(one.x - corner.x, one.z - corner.z))
      .filter(one => one < 3)

    // Half a width is 1, and a right angle stretches it by 1/cos(45°): the outer corner stands
    // at √2 exactly. Anything short of it is the wedge a square cut would leave.
    expect(Math.max(...reach)).toBeCloseTo(Math.SQRT2, 5)
  })

  /** A closed run has no end to cap, and its last section meets the first on a mitred joint. */
  it('closes on itself without a seam', () => {
    const square = [at(-5, -5), at(5, -5), at(5, 5), at(-5, 5)]
    const closed = cornersOf(band(square, { closed: true }))

    // Four links, no cap — and the outer edge stands half a width past the run on every side.
    expect(closed).toHaveLength(4 * 4 * 6)
    expect(new Box3().setFromPoints(closed).getSize(new Vector3()).x).toBeCloseTo(12, 5)
  })

  /** Fewer than two points describes no run, and a shape with no surface is better than a throw. */
  it('draws nothing from a run of one point', () => {
    expect(cornersOf(band([at(0, 0)]))).toEqual([])
  })

  /**
   * The UVs are DISTANCES in metres — `spanOf` hands a ribbon a span of one, so `tilesPerMetre`
   * means what it says. Read across the band, the far edge stands at its full width.
   */
  it('measures its own surface in metres', () => {
    const geometry = band([at(0, 6), at(0, -6)])
    const uv = geometry.getAttribute('uv') as BufferAttribute
    const along = Array.from({ length: uv.count }, (_, at) => uv.getX(at))
    const across = Array.from({ length: uv.count }, (_, at) => uv.getY(at))

    expect(Math.max(...along)).toBeCloseTo(12, 5)
    expect(Math.max(...across)).toBeCloseTo(2, 5)
  })
})
