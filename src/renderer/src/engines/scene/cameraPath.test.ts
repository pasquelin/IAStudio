import { describe, expect, it } from 'vitest'
import { DEFAULT_PATH, type PathDescriptor } from '@shared/domain/scene'
import { curveOf, pathPoints, withMovedPoint, withPointAfter, withoutPoint } from './cameraPath'

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

  it('drops a point', () => {
    expect(withoutPoint(three, 1).points.map(point => point.x)).toEqual([0, 20])
  })

  // One point is not a line: a rail that could be emptied would be a node drawing nothing.
  it('refuses to drop below two points', () => {
    const two = pathOf([at(0), at(10)])
    expect(withoutPoint(two, 0)).toBe(two)
  })
})
