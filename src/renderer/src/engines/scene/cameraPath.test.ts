import { describe, expect, it } from 'vitest'
import { DEFAULT_PATH, type PathDescriptor } from '@shared/domain/scene'
import {
  curveOf,
  pathPoints,
  segmentAt,
  withMovedPoint,
  withPointAfter,
  withPointAppended,
  withPointAtEnd,
  withoutPoint,
} from './cameraPath'

const pathOf = (points: PathDescriptor['points']): PathDescriptor => ({ ...DEFAULT_PATH, points })

const at = (x: number) => ({ x, y: 0, z: 0 })

describe('the curve of a rail', () => {
  // Rebuilding it per frame would walk the whole curve for arc lengths that have not changed.
  it('hands back the same curve while the descriptor is the same object', () => {
    const path = pathOf([at(0), at(10)])
    expect(curveOf(path)).toBe(curveOf(path))
  })

  it('builds another one for a rail whose points moved', () => {
    expect(curveOf(pathOf([at(0), at(10)]))).not.toBe(curveOf(pathOf([at(0), at(20)])))
  })

  it('samples the line it draws, in order, from end to end', () => {
    const drawn = pathPoints(pathOf([at(0), at(10)]), 4)

    expect(drawn).toHaveLength(5)
    expect(drawn[0]?.x).toBeCloseTo(0, 3)
    expect(drawn.at(-1)?.x).toBeCloseTo(10, 3)
  })
})

describe('the stretch of rail an abscissa falls in', () => {
  // Three points, two stretches, the second one three times as long as the first: measured by
  // arc length, the middle point stands a quarter of the way along and not halfway.
  const uneven = pathOf([at(0), at(10), at(40)])

  it('names the stretch before the middle point for an abscissa short of it', () => {
    expect(segmentAt(uneven, 0.1)).toBe(0)
  })

  it('names the stretch after it for an abscissa past it', () => {
    expect(segmentAt(uneven, 0.5)).toBe(1)
  })

  // The straight-line reading would answer 1 here — half of the rail's extent is past the middle
  // point — and pose the new point in the wrong stretch.
  it('reads the abscissa by arc length rather than by extent', () => {
    expect(segmentAt(uneven, 0.24)).toBe(0)
  })

  it('holds the last stretch for the very end of the rail', () => {
    expect(segmentAt(uneven, 1)).toBe(1)
  })

  it('gives a closed rail one stretch more, the one that comes back to the first point', () => {
    expect(segmentAt({ ...uneven, closed: true }, 0.99)).toBe(2)
  })
})

describe('editing the points of a rail', () => {
  const three = pathOf([at(0), at(10), at(20)])

  it('moves one point and leaves the others where they stand', () => {
    expect(withMovedPoint(three, 1, at(5)).points.map(point => point.x)).toEqual([0, 5, 20])
  })

  it('leaves the rail alone for an index no point answers to', () => {
    expect(withMovedPoint(three, 9, at(5))).toBe(three)
  })

  // Halfway along the STRAIGHT line, not along the curve: a point placed on the curve would
  // change nothing of the shape, which reads as a click that did nothing.
  it('adds a point halfway to the next one', () => {
    expect(withPointAfter(three, 0).points.map(point => point.x)).toEqual([0, 5, 10, 20])
  })

  it('adds a point after the last one by folding back to the first', () => {
    expect(withPointAfter(three, 2).points.map(point => point.x)).toEqual([0, 10, 20, 10])
  })

  /**
   * The gesture of the panel, which has no stretch of line to aim at. Its own case, because
   * `withPointAfter` on the last point does something else entirely on an OPEN rail.
   */
  it('extends an open rail past its last point, by half its last span', () => {
    expect(withPointAtEnd(three).points.map(point => point.x)).toEqual([0, 10, 20, 25])
  })

  it('lays a point in the span that comes back to the first point of a closed rail', () => {
    const closed = { ...pathOf([at(0), at(10), at(20)]), closed: true }

    expect(withPointAtEnd(closed).points.map(point => point.x)).toEqual([0, 10, 20, 10])
  })

  /** The gesture of the viewport: a place was AIMED at, so nothing is guessed about where. */
  it('appends a point exactly where a click named, on a closed rail as on an open one', () => {
    expect(withPointAppended(three, at(7)).points.map(point => point.x)).toEqual([0, 10, 20, 7])

    const closed = { ...three, closed: true }
    expect(withPointAppended(closed, at(7)).points.map(point => point.x)).toEqual([0, 10, 20, 7])
  })

  it('drops a point', () => {
    expect(withoutPoint(three, 1).points.map(point => point.x)).toEqual([0, 20])
  })

  // One point is not a line: a rail that could be emptied would be a node drawing nothing.
  it('refuses to drop below two points', () => {
    const two = pathOf([at(0), at(10)])
    expect(withoutPoint(two, 0)).toBe(two)
  })
})
