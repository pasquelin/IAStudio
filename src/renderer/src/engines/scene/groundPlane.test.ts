import { describe, expect, it } from 'vitest'
import { Box3, Mesh, Raycaster, Vector3, type Material, type Object3D } from 'three'
import { DEFAULT_GROUND } from '@shared/domain/scene'
import { createGroundPlane } from './groundPlane'

const shown = { ...DEFAULT_GROUND, visible: true }

function materialOf(object: Object3D): Material | null {
  if (!(object instanceof Mesh)) return null
  return Array.isArray(object.material) ? null : object.material
}

describe('the ground of a scene', () => {
  it('is not drawn until the document asks for it', () => {
    const ground = createGroundPlane()
    ground.apply(DEFAULT_GROUND, '#ffffff')

    expect(ground.object.visible).toBe(false)
  })

  /**
   * `transparent` is a shader define — `#define OPAQUE` forces the fragment's alpha to 1 — and
   * three recompiles only on a version bump. Without one the opacity slider moved nothing at all.
   */
  it('recompiles when it starts being see-through, and only then', () => {
    const ground = createGroundPlane()
    ground.apply(shown, '#ffffff')

    const material = materialOf(ground.object)
    const opaque = material?.version ?? 0

    ground.apply({ ...shown, opacity: 0.5 }, '#ffffff')
    expect(material?.version).toBeGreaterThan(opaque)

    // Moving it again inside the same state must not recompile a whole material per frame.
    const clear = material?.version ?? 0
    ground.apply({ ...shown, opacity: 0.2 }, '#ffffff')
    expect(material?.version).toBe(clear)
  })

  it('spans the size the document asks for', () => {
    const ground = createGroundPlane()
    ground.apply({ ...shown, size: 40 }, '#ffffff')

    const bounds = new Box3().setFromObject(ground.object).getSize(new Vector3())
    expect(bounds.x).toBeCloseTo(40)
    expect(bounds.z).toBeCloseTo(40)
  })

  // A plane the size of the scene sits under every click: left in the ray it would take every
  // selection meant for what stands on it.
  it('is never picked', () => {
    const ground = createGroundPlane()
    ground.apply(shown, '#ffffff')

    const ray = new Raycaster(new Vector3(0, 5, 0), new Vector3(0, -1, 0))

    expect(ray.intersectObject(ground.object, true)).toEqual([])
  })

  it('lies flat rather than standing up, which a plane geometry does by itself', () => {
    const ground = createGroundPlane()

    expect(ground.object.rotation.x).toBeCloseTo(-Math.PI / 2)
  })

  it('takes itself out of the scene when disposed of', () => {
    const ground = createGroundPlane()
    ground.apply(shown, '#ffffff')
    ground.dispose()

    expect(ground.object.parent).toBe(null)
  })
})
