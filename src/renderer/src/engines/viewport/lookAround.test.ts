import { describe, expect, it } from 'vitest'
import { POLE_LIMIT } from '@shared/domain/angles'
import { DEFAULT_LOOK, turnBy } from './lookAround'

describe('turning the head', () => {
  it('leaves the angles alone when the pointer did not move', () => {
    expect(turnBy(DEFAULT_LOOK, 0, 0)).toEqual(DEFAULT_LOOK)
  })

  it('turns further the further the drag goes', () => {
    const short = turnBy(DEFAULT_LOOK, 10, 0).azimuth
    const long = turnBy(DEFAULT_LOOK, 40, 0).azimuth
    expect(long).toBeGreaterThan(short)
  })

  it('takes a sensitivity, so a caller can slow a precise gesture down', () => {
    const normal = turnBy(DEFAULT_LOOK, 100, 0).azimuth
    const slow = turnBy(DEFAULT_LOOK, 100, 0, 0.001).azimuth
    expect(slow).toBeLessThan(normal)
  })

  it('accumulates across successive drags', () => {
    const once = turnBy(DEFAULT_LOOK, 50, 20)
    const twice = turnBy(once, 50, 20)
    expect(twice.azimuth).toBeCloseTo(once.azimuth * 2, 12)
    expect(twice.elevation).toBeCloseTo(once.elevation * 2, 12)
  })

  it('wraps the azimuth instead of letting it grow without end', () => {
    const spun = turnBy(DEFAULT_LOOK, -100, 0)
    expect(spun.azimuth).toBeGreaterThanOrEqual(0)
    expect(spun.azimuth).toBeLessThan(Math.PI * 2)
  })

  it('stops just short of the poles, where the azimuth stops meaning anything', () => {
    expect(turnBy(DEFAULT_LOOK, 0, 100000).elevation).toBe(POLE_LIMIT)
    expect(turnBy(DEFAULT_LOOK, 0, -100000).elevation).toBe(-POLE_LIMIT)
  })

  it('cannot be walked past the pole one small drag at a time', () => {
    let angles = DEFAULT_LOOK
    for (let i = 0; i < 500; i++) angles = turnBy(angles, 0, 50)
    expect(angles.elevation).toBe(POLE_LIMIT)
  })
})
