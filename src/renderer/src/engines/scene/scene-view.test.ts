import {
  BoxGeometry,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyDisplayMode,
  applyWireOverlay,
  isDisplayMode,
  isViewDirection,
  viewPosition,
  VIEW_DIRECTIONS,
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
