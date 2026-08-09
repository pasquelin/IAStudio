import {
  BoxGeometry,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
} from 'three'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyDisplayMode,
  applyWireOverlay,
  directionOf,
  isDisplayMode,
  isViewDirection,
  viewPosition,
  VIEW_DIRECTIONS,
  framingDistance,
  framingPlacement,
} from './scene-view'

const ORIGIN = new Vector3(0, 0, 0)

describe('viewPosition', () => {
  it('stands on the axis the side names, at the distance it was given', () => {
    expect(viewPosition('front', ORIGIN, 10)).toMatchObject({ x: 0, y: 0, z: 10 })
    expect(viewPosition('back', ORIGIN, 10)).toMatchObject({ x: 0, y: 0, z: -10 })
    expect(viewPosition('right', ORIGIN, 10)).toMatchObject({ x: 10, y: 0, z: 0 })
    expect(viewPosition('left', ORIGIN, 10)).toMatchObject({ x: -10, y: 0, z: 0 })
  })

  it('keeps the distance it was given, whatever the side', () => {
    for (const direction of VIEW_DIRECTIONS) {
      const { x, y, z } = viewPosition(direction, ORIGIN, 10)
      expect(Math.hypot(x, y, z)).toBeCloseTo(10, 2)
    }
  })

  it('stands around the target rather than around the origin', () => {
    expect(viewPosition('right', new Vector3(1, 2, 3), 4)).toMatchObject({ x: 5, y: 2, z: 3 })
  })

  // A polar angle of exactly zero has no azimuth: the next drag would snap the view sideways.
  it('nudges the two vertical sides off the axis', () => {
    expect(viewPosition('top', ORIGIN, 10).z).not.toBe(0)
    expect(viewPosition('bottom', ORIGIN, 10).z).not.toBe(0)
    expect(viewPosition('top', ORIGIN, 10).y).toBe(10)
  })
})

describe('isViewDirection', () => {
  it('accepts a side and refuses anything else', () => {
    expect(isViewDirection('top')).toBe(true)
    expect(isViewDirection('sideways')).toBe(false)
  })
})

/**
 * What the trihedron's click is read through. It is the inverse of `viewPosition`, so the two are
 * tested against each other: a sign flipped in either would make them disagree.
 */
describe('directionOf', () => {
  it('names the side of every place a normalised view stands', () => {
    for (const direction of VIEW_DIRECTIONS) {
      const { x, y, z } = viewPosition(direction, ORIGIN, 10)

      expect(directionOf(new Vector3(x, y, z))).toBe(direction)
    }
  })

  it('names it from wherever the view was turning around', () => {
    const target = new Vector3(1, 2, 3)
    const { x, y, z } = viewPosition('left', target, 4)

    expect(directionOf(new Vector3(x - target.x, y - target.y, z - target.z))).toBe('left')
  })

  it('names no side for a direction that points between two', () => {
    expect(directionOf(new Vector3(1, 1, 0))).toBeNull()
  })

  // The camera sitting exactly on its target names no side rather than an arbitrary one.
  it('names no side for a direction of no length', () => {
    expect(directionOf(new Vector3(0, 0, 0))).toBeNull()
  })

  it('forgives the wobble a nudged pole leaves behind', () => {
    expect(directionOf(new Vector3(0, 10, 0.001))).toBe('top')
  })
})

describe('isDisplayMode', () => {
  it('accepts a mode and refuses anything else', () => {
    expect(isDisplayMode('wireframe')).toBe(true)
    expect(isDisplayMode('box')).toBe(false)
  })
})

/** The material is handed back beside the mesh: `Mesh.material` is typed as one or several. */
function meshTree(): { mesh: Mesh; material: MeshStandardMaterial } {
  const material = new MeshStandardMaterial()
  return { mesh: new Mesh(new BoxGeometry(), material), material }
}

describe('applyDisplayMode', () => {
  it('turns the material to wireframe, and back', () => {
    const { mesh, material } = meshTree()

    applyDisplayMode(mesh, 'wireframe')
    expect(material.wireframe).toBe(true)

    applyDisplayMode(mesh, 'shaded')
    expect(material.wireframe).toBe(false)
  })

  // `both` shows the surfaces: the wireframe of that mode is the overlay, not the material.
  it('leaves the material shaded in the mode that shows both', () => {
    const { mesh, material } = meshTree()

    applyDisplayMode(mesh, 'both')

    expect(material.wireframe).toBe(false)
  })

  it('reaches every mesh under the object, as a model is one node over many', () => {
    const root = meshTree()
    const child = meshTree()
    root.mesh.add(child.mesh)

    applyDisplayMode(root.mesh, 'wireframe')

    expect(child.material.wireframe).toBe(true)
  })

  it('walks past what is not a mesh', () => {
    const empty = new Object3D()
    empty.add(new Object3D())

    expect(() => applyDisplayMode(empty, 'wireframe')).not.toThrow()
  })

  // `Material` itself declares no `wireframe`; only the mesh materials do, and writing one onto
  // a material that has none would be a property three.js never reads.
  it('leaves a material with no wireframe of its own without one', () => {
    const mesh = new Mesh(new BoxGeometry(), new Material())

    applyDisplayMode(mesh, 'wireframe')

    expect('wireframe' in mesh.material).toBe(false)
  })

  it('reaches every material of a mesh that carries several', () => {
    const materials = [new MeshStandardMaterial(), new MeshStandardMaterial()]
    const mesh = new Mesh(new BoxGeometry(), materials)

    applyDisplayMode(mesh, 'wireframe')

    expect(materials.every(material => material.wireframe)).toBe(true)
  })
})

describe('applyWireOverlay', () => {
  const line = new LineBasicMaterial()

  it('hangs edges under each mesh, and takes them away again', () => {
    const { mesh } = meshTree()

    applyWireOverlay(mesh, true, line)
    expect(mesh.children.filter(child => child instanceof LineSegments)).toHaveLength(1)

    applyWireOverlay(mesh, false, line)
    expect(mesh.children).toHaveLength(0)
  })

  // Applied twice, it would otherwise stack a second set of edges on the first.
  it('never leaves two sets of edges on one mesh', () => {
    const { mesh } = meshTree()

    applyWireOverlay(mesh, true, line)
    applyWireOverlay(mesh, true, line)

    expect(mesh.children).toHaveLength(1)
  })

  it('covers a whole model, not only the object it was handed', () => {
    const { mesh } = meshTree()
    const child = meshTree()
    mesh.add(child.mesh)

    applyWireOverlay(mesh, true, line)

    expect(mesh.children.filter(node => node instanceof LineSegments)).toHaveLength(1)
    expect(child.mesh.children.filter(node => node instanceof LineSegments)).toHaveLength(1)
  })

  // Left behind, every switch of the mode would leak a buffer on the GPU.
  it('frees the geometry of the edges it removes', () => {
    const { mesh } = meshTree()
    applyWireOverlay(mesh, true, line)
    const edges = mesh.children[0]
    let freed = false
    if (edges instanceof LineSegments)
      edges.geometry.addEventListener('dispose', () => (freed = true))

    applyWireOverlay(mesh, false, line)

    expect(freed).toBe(true)
  })

  it('keeps the edges out of the shadow map, being decoration', () => {
    const { mesh } = meshTree()

    applyWireOverlay(mesh, true, line)

    expect(mesh.children[0]).toMatchObject({ castShadow: false, receiveShadow: false })
  })

  // The overlay is found by name: something else wearing it is taken away all the same, rather
  // than left to accumulate under the mesh.
  it('takes away an overlay that carries no geometry of its own', () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    const impostor = new Object3D()
    impostor.name = 'wireframe-overlay'
    mesh.add(impostor)

    applyWireOverlay(mesh, false, line)

    expect(mesh.children).toHaveLength(0)
  })
})

/**
 * A line is met within a whole world unit of itself — `Raycaster.params.Line.threshold`. The
 * overlay is decoration hanging under every mesh, so left pickable it grows a halo of that size
 * around every edge in the scene, and a click into the void beside a cube selects the cube.
 */
describe('the wireframe overlay under the pointer', () => {
  it('is never what a ray meets', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial())
    mesh.updateMatrixWorld(true)
    applyWireOverlay(mesh, true, new LineBasicMaterial())

    // Beside the box, not through it: x sits outside the half-width, well inside the threshold.
    const raycaster = new Raycaster(new Vector3(0.9, 0, 5), new Vector3(0, 0, -1))

    expect(raycaster.intersectObject(mesh, true)).toEqual([])
  })
})

/**
 * The whole of what framing does, once the orthographic frustum stopped ignoring the move: a
 * constant step framed a studio primitive and stood inside a fifty-unit model.
 */
describe('framingDistance', () => {
  // tan(45°) = 1, so a 90° lens needs exactly the half-size, plus the margin.
  it('stands as far back as the object is wide, for a square lens', () => {
    expect(framingDistance(10, 90)).toBeCloseTo(12, 5)
  })

  // The defect it replaces: the same distance whatever the size.
  it('stands further back for a bigger object', () => {
    expect(framingDistance(50, 60)).toBeGreaterThan(framingDistance(5, 60))
  })

  // A narrower lens sees less at the same distance, so it has to back off further.
  it('stands further back for a narrower lens', () => {
    expect(framingDistance(10, 30)).toBeGreaterThan(framingDistance(10, 90))
  })

  /**
   * A point light and an empty group have no size at all, and would ask for a distance of nil.
   * The value, not just « more than zero » : a floor of a millimetre also clears that bar, and
   * would frame a light from inside it.
   */
  it('keeps a usable distance from something with no size', () => {
    // 0.5 / tan(45°) × 1.2 — the floor, the lens and the margin, pinned together.
    expect(framingDistance(0, 90)).toBeCloseTo(0.6, 5)
  })
})

/**
 * The composition `frameSelection` performs, which no test could reach while it lived inside a
 * method that returns early without mounted orbit controls.
 */
describe('framingPlacement', () => {
  const boxAt = (x: number, size: number): Mesh =>
    new Mesh(new BoxGeometry(size, size, size)).translateX(x)

  it('looks at the middle of what is enclosed, not at the average of the placements', () => {
    // Two boxes of very different sizes: their centroid and their bounds centre disagree.
    const target = framingPlacement([boxAt(0, 2), boxAt(20, 10)], 60).target

    expect(target.x).toBeCloseTo(12, 5)
  })

  it('stands back by what the size asks for, along the studio diagonal', () => {
    const { target, position } = framingPlacement([boxAt(0, 50)], 60)
    const away = position.clone().sub(target)

    expect(away.length()).toBeCloseTo(framingDistance(25, 60), 5)
    // Normalised, and the same on all three axes — an unnormalised step would be √3 times too far.
    expect(away.x).toBeCloseTo(away.length() / Math.sqrt(3), 5)
    expect(away.y).toBeCloseTo(away.x, 5)
  })

  // The defect it replaces: a constant step, so the same distance whatever the selection.
  it('stands further back for a bigger selection', () => {
    const near = framingPlacement([boxAt(0, 2)], 60)
    const far = framingPlacement([boxAt(0, 50)], 60)

    expect(far.position.length()).toBeGreaterThan(near.position.length() * 5)
  })

  // A light and an empty group enclose nothing; their placements still average to somewhere.
  it('falls back on the average placement when nothing encloses a box', () => {
    const lamp = new Object3D().translateX(10)
    const other = new Object3D().translateX(20)

    expect(framingPlacement([lamp, other], 60).target.x).toBeCloseTo(15, 5)
  })
})
