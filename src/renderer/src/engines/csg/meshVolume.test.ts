import { BoxGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { meshVolume } from './meshVolume'

describe('meshVolume', () => {
  it('measures what a shape encloses', () => {
    expect(meshVolume(new BoxGeometry(2, 3, 4))).toBeCloseTo(24, 6)
  })

  /** The sign is the whole point: it is what tells a solid from the same solid inside out. */
  it('turns negative when a mirror has wound every face the other way', () => {
    expect(meshVolume(new BoxGeometry(2, 3, 4).scale(-1, 1, 1))).toBeCloseTo(-24, 6)
  })

  it('measures a shape that carries no index, corner by corner', () => {
    expect(meshVolume(new BoxGeometry(2, 3, 4).toNonIndexed())).toBeCloseTo(24, 6)
  })
})
