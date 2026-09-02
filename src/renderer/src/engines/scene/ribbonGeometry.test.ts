import { Box3, Vector3, type BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PATH,
  type GeometryDescriptor,
  type Vector3 as PlainVector3,
} from '@shared/domain/scene'
import { offsetRun, ribbonGeometry, sampledRun } from './ribbonGeometry'

const at = (x: number, z: number): PlainVector3 => ({ x, y: 0, z })

const railOf = (points: readonly PlainVector3[], closed = false) => ({
  ...DEFAULT_PATH,
  points,
  closed,
})

const band = (
  points: readonly PlainVector3[],
  over: { width?: number; closed?: boolean; segments?: number } = {},
): GeometryDescriptor => ({
  kind: 'ribbon',
  path: railOf(points, over.closed ?? false),
  width: over.width ?? 2,
  height: 0.5,
  segments: over.segments ?? 32,
})

const cornersOf = (shape: GeometryDescriptor): Vector3[] => {
  const position = ribbonGeometry(
    shape as Extract<GeometryDescriptor, { kind: 'ribbon' }>,
  ).getAttribute('position') as BufferAttribute
  return Array.from(
    { length: position.count },
    (_, at) => new Vector3(position.getX(at), position.getY(at), position.getZ(at)),
  )
}

/** The sharpest turn between two consecutive sections, in degrees. */
function sharpestTurn(run: readonly PlainVector3[]): number {
  let worst = 0
  for (let at = 1; at < run.length - 1; at += 1) {
    const before = Math.atan2(run[at]!.x - run[at - 1]!.x, run[at]!.z - run[at - 1]!.z)
    const after = Math.atan2(run[at + 1]!.x - run[at]!.x, run[at + 1]!.z - run[at]!.z)
    const turn = Math.abs(((after - before + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    worst = Math.max(worst, (turn * 180) / Math.PI)
  }
  return worst
}

describe('a ribbon', () => {
  /**
   * 🛑 What a run of boxes could never do, and what Alban asked for: the band follows the CURVE
   * through its marks, so a corner comes out round. The marks alone made a polygon.
   */
  it('rounds a turn instead of cornering it', () => {
    const marks = [at(-10, 0), at(0, 0), at(0, -10)]

    expect(sharpestTurn(marks)).toBeCloseTo(90, 5)
    expect(sharpestTurn(sampledRun(railOf(marks), 32))).toBeLessThan(20)
  })

  /** More sections is a rounder turn: the field is what an author reaches for when it shows. */
  it('turns more smoothly the more sections it is cut into', () => {
    const marks = [at(-10, 0), at(0, 0), at(0, -10)]

    expect(sharpestTurn(sampledRun(railOf(marks), 64))).toBeLessThan(
      sharpestTurn(sampledRun(railOf(marks), 8)),
    )
  })

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
   * 🛑 The joint, on the bisector: cut square, two sections meeting at an angle leave a WEDGE of
   * nothing outside the turn; overlapped to close it, their corners stand proud.
   */
  it('mitres a joint rather than cutting it square', () => {
    const shifted = offsetRun([at(-10, 0), at(0, 0), at(0, -10)], 1, false)

    // A right angle stretches a one-metre offset by 1/cos(45°): the joint lands at √2 exactly.
    expect(Math.hypot(shifted[1]!.x, shifted[1]!.z)).toBeCloseTo(Math.SQRT2, 5)
  })

  /** A closed run has no end to cap, and no seam where the last section meets the first. */
  it('closes on itself without a seam', () => {
    const square = [at(-5, -5), at(5, -5), at(5, 5), at(-5, 5)]
    const corners = cornersOf(band(square, { closed: true, segments: 40 }))

    // Forty sections, four faces each, four corners a face — indexed, so a quad's two triangles
    // share them. No cap at either end.
    expect(corners).toHaveLength(40 * 4 * 4)
  })

  /** Fewer than two points describes no run, and a shape with no surface beats a throw. */
  it('draws nothing from a run of one point', () => {
    expect(cornersOf(band([at(0, 0)]))).toEqual([])
  })

  /**
   * The UVs are DISTANCES in metres — `spanOf` hands a ribbon a span of one, so `tilesPerMetre`
   * means what it says. Read across the band, the far edge stands at its full width.
   */
  it('measures its own surface in metres', () => {
    const geometry = ribbonGeometry(
      band([at(0, 6), at(0, -6)]) as Extract<GeometryDescriptor, { kind: 'ribbon' }>,
    )
    const uv = geometry.getAttribute('uv') as BufferAttribute
    const along = Array.from({ length: uv.count }, (_, at) => uv.getX(at))
    const across = Array.from({ length: uv.count }, (_, at) => uv.getY(at))

    expect(Math.max(...along)).toBeCloseTo(12, 4)
    expect(Math.max(...across)).toBeCloseTo(2, 5)
  })
})
