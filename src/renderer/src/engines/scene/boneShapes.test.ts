import { Bone, Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { createBoneShapes } from './boneShapes'

/** A runner resolves no custom property, so both tokens come back the same: they are handed in. */
const colours = () => ({ rest: '#808080', picked: '#346ef2' })

/** Two bones, one under the other, so a world placement is not the local one. */
function chain(): Bone[] {
  const hips = new Bone()
  hips.name = 'Hips'
  hips.position.set(0, 1, 0)

  const spine = new Bone()
  spine.name = 'Spine'
  spine.position.set(0, 0.4, 0)
  hips.add(spine)

  const root = new Object3D()
  root.add(hips)
  root.updateWorldMatrix(false, true)
  return [hips, spine]
}

/** The corners of one bone's solid, as triples. */
function cornersOf(shapes: ReturnType<typeof createBoneShapes>, bone: number): number[][] {
  const position = shapes.mesh.geometry.getAttribute('position')
  const corners: number[][] = []
  for (let corner = bone * 24; corner < (bone + 1) * 24; corner += 1) {
    corners.push([position.getX(corner), position.getY(corner), position.getZ(corner)])
  }
  return corners
}

describe('drawing a bone as a solid', () => {
  // A segment says where a bone runs and nothing about which way it faces, so a rotation moved
  // the gizmo and left the skeleton looking identical — measured on screen.
  it('lays eight faces per bone, spanning it from head to tail', () => {
    const shapes = createBoneShapes(chain(), colours)

    expect(shapes.mesh.geometry.getAttribute('position').count).toBe(2 * 8 * 3)

    const ys = cornersOf(shapes, 0).map(([, y]) => y ?? 0)
    expect(Math.min(...ys)).toBeCloseTo(1, 5)
    expect(Math.max(...ys)).toBeCloseTo(1.4, 5)
    shapes.dispose()
  })

  // The waist ring is what a turn about the bone's own axis actually moves; a shape that were
  // round about its axis would look identical at every angle.
  it('widens the bone away from its own axis, which is what makes a turn visible', () => {
    const shapes = createBoneShapes(chain(), colours)
    const off = cornersOf(shapes, 0).filter(([x, , z]) => Math.hypot(x ?? 0, z ?? 0) > 1e-6)

    expect(off.length).toBeGreaterThan(0)
    shapes.dispose()
  })

  it('paints the chosen bone apart from the rest, and only that one', () => {
    const shapes = createBoneShapes(chain(), colours)
    const colour = shapes.mesh.geometry.getAttribute('color')

    shapes.pick('Spine')

    expect(colour.getX(0)).not.toBeCloseTo(colour.getX(24), 5)
    shapes.dispose()
  })

  it('is never what a click lands on — the model is', () => {
    const shapes = createBoneShapes(chain(), colours)
    const hits: unknown[] = []

    shapes.mesh.raycast({} as never, hits as never)

    expect(hits).toEqual([])
    shapes.dispose()
  })
})
