import { Ray, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { spotOnRay } from './railSpot'

describe('where a click that met no scenery lays a point', () => {
  const anchor = new Vector3(0, 3, 0)

  it('lands on the level plane through the anchor, whatever the pointer aimed at', () => {
    const looking = new Vector3(0, -1, -1).normalize()
    const spot = spotOnRay(new Ray(new Vector3(0, 13, 0), looking), anchor, looking)

    expect(spot?.y).toBeCloseTo(3, 6)
    expect(spot?.z).toBeCloseTo(-10, 6)
  })

  /**
   * The front and the side panes of a quad view look dead level, so their rays run parallel to
   * that plane and meet it nowhere. Without the second plane the gesture is inert in them.
   */
  it('lands on the plane facing a camera looking dead level, which the first one never meets', () => {
    const looking = new Vector3(0, 0, -1)
    const spot = spotOnRay(new Ray(new Vector3(2, 9, 20), looking), anchor, looking)

    expect(spot?.x).toBeCloseTo(2, 6)
    expect(spot?.y).toBeCloseTo(9, 6)
    expect(spot?.z).toBeCloseTo(0, 6)
  })

  it('answers nothing for an anchor the ray runs away from', () => {
    const looking = new Vector3(0, 1, 0)
    expect(spotOnRay(new Ray(new Vector3(0, 13, 0), looking), anchor, looking)).toBeNull()
  })
})
