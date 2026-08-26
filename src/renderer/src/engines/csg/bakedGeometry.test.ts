import { BoxGeometry, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import { bakedGeometry } from './bakedGeometry'
import { meshVolume } from './meshVolume'

const placed = (scale: Transform['scale']): Transform => ({ ...IDENTITY_TRANSFORM, scale })

describe('bakedGeometry', () => {
  it('puts a shape where its brush stands', () => {
    const baked = bakedGeometry(new BoxGeometry(1, 1, 1), placed({ x: 1, y: 6, z: 1 }))
    expect(meshVolume(baked)).toBeCloseTo(6, 6)
  })

  /**
   * The defect this module exists for: a gizmo drag through zero flips the sign of a scale, the
   * inspector says so and nothing else does, and every boolean on that shape came out inside out.
   */
  it('puts the winding back when a placement mirrors the shape', () => {
    const baked = bakedGeometry(new BoxGeometry(1, 1, 1), placed({ x: -2, y: -7, z: -7 }))

    // Positive, where the same bake without the flip measured -98.
    expect(meshVolume(baked)).toBeCloseTo(98, 6)
  })

  /** Two mirrors are a turn, and a turn winds nothing backwards. */
  it('leaves the winding alone when two axes are flipped at once', () => {
    const baked = bakedGeometry(new BoxGeometry(1, 1, 1), placed({ x: -2, y: -7, z: 7 }))
    expect(meshVolume(baked)).toBeCloseTo(98, 6)
  })

  it('flips a shape that carries no index', () => {
    const baked = bakedGeometry(
      new BoxGeometry(1, 1, 1).toNonIndexed(),
      placed({ x: -1, y: 1, z: 1 }),
    )
    expect(meshVolume(baked)).toBeCloseTo(1, 6)
  })

  /**
   * `applyMatrix4` runs normals through the inverse transpose, which mirrors them correctly on
   * its own — so the flip must NOT recompute them, and this is what says the two agree.
   */
  it('keeps every normal pointing out of the mirrored shape', () => {
    const baked = bakedGeometry(new BoxGeometry(2, 2, 2), placed({ x: -1, y: 1, z: 1 }))
    const position = baked.getAttribute('position')
    const normal = baked.getAttribute('normal')

    for (let at = 0; at < position.count; at += 1) {
      const outward = new Vector3(position.getX(at), position.getY(at), position.getZ(at))
      const face = new Vector3(normal.getX(at), normal.getY(at), normal.getZ(at))
      expect(outward.dot(face)).toBeGreaterThan(0)
    }
  })
})
