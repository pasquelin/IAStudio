import { describe, expect, it } from 'vitest'
import {
  BoxHelper,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Object3D,
  Raycaster,
  Vector3,
} from 'three'
import { createViewportAids, type AidPalette, type AidSettings } from './viewportAids'

const PALETTE: AidPalette = { box: '#ffffff', origin: '#888888', normal: '#00ff00' }

const OFF: AidSettings = {
  boundingBoxes: 'off',
  origins: false,
  normals: false,
  normalLength: 0.2,
}

/** A mesh with real normals, which is what `VertexNormalsHelper` reads in its constructor. */
function meshWithNormals(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(9), 3))
  return new Mesh(geometry)
}

/** What a generated asset routinely arrives as: a mesh carrying no normals at all. */
function meshWithout(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
  return new Mesh(geometry)
}

const boxes = (host: Object3D) => host.children.filter(child => child instanceof BoxHelper)

describe('the aids drawn over a scene', () => {
  it('draws nothing at all by default', () => {
    const aids = createViewportAids()
    aids.apply(new Map([['a', new Object3D()]]), [], OFF, PALETTE)

    expect(aids.object.children).toHaveLength(0)
  })

  it('boxes the selection alone, or every object, on the setting', () => {
    const aids = createViewportAids()
    const objects = new Map([
      ['a', new Object3D()],
      ['b', new Object3D()],
    ])

    aids.apply(objects, ['a'], { ...OFF, boundingBoxes: 'selected' }, PALETTE)
    expect(boxes(aids.object)).toHaveLength(1)

    aids.apply(objects, ['a'], { ...OFF, boundingBoxes: 'all' }, PALETTE)
    expect(boxes(aids.object)).toHaveLength(2)

    aids.apply(objects, ['a'], OFF, PALETTE)
    expect(boxes(aids.object)).toHaveLength(0)
  })

  // The map is keyed by node, and a node that left the scene leaves a helper drawn over nothing.
  it('drops the box of an object that has left the scene', () => {
    const aids = createViewportAids()
    const settings = { ...OFF, boundingBoxes: 'all' } satisfies AidSettings

    aids.apply(new Map([['a', new Object3D()]]), [], settings, PALETTE)
    aids.apply(new Map(), [], settings, PALETTE)

    expect(aids.object.children).toHaveLength(0)
  })

  it('keeps the helper it already built when nothing moved', () => {
    const aids = createViewportAids()
    const objects = new Map([['a', new Object3D()]])
    const settings = { ...OFF, boundingBoxes: 'all' } satisfies AidSettings

    aids.apply(objects, [], settings, PALETTE)
    const built = boxes(aids.object)[0]
    aids.apply(objects, [], settings, PALETTE)

    expect(boxes(aids.object)[0]).toBe(built)
  })

  /**
   * `VertexNormalsHelper` reads `geometry.attributes.normal.count` in its constructor and throws
   * without one — and a generated model routinely arrives with a mesh that has none. Left
   * unguarded, the toggle takes the viewport down on somebody's asset.
   */
  it('draws no normals on a mesh that carries none, rather than throwing', () => {
    const aids = createViewportAids()
    const objects = new Map([['a', meshWithout()]])

    expect(() => aids.apply(objects, ['a'], { ...OFF, normals: true }, PALETTE)).not.toThrow()
    expect(aids.object.children).toHaveLength(0)
  })

  it('draws normals on the selection alone, and gives them back when it changes', () => {
    const aids = createViewportAids()
    const objects = new Map([
      ['a', meshWithNormals()],
      ['b', meshWithNormals()],
    ])
    const settings = { ...OFF, normals: true } satisfies AidSettings

    aids.apply(objects, ['a'], settings, PALETTE)
    expect(aids.object.children).toHaveLength(1)

    aids.apply(objects, ['a', 'b'], settings, PALETTE)
    expect(aids.object.children).toHaveLength(2)
  })

  it('hangs everything from one group, so a render pass hides the lot with one flag', () => {
    const aids = createViewportAids()
    aids.apply(
      new Map([['a', meshWithNormals()]]),
      ['a'],
      { boundingBoxes: 'all', origins: true, normals: true, normalLength: 0.2 },
      PALETTE,
    )

    expect(aids.object.children.length).toBeGreaterThan(2)
    expect(aids.object.children.every(child => child.parent === aids.object)).toBe(true)
  })

  it('gives every helper back when it is disposed of', () => {
    const aids = createViewportAids()
    aids.apply(
      new Map([['a', meshWithNormals()]]),
      ['a'],
      { boundingBoxes: 'all', origins: true, normals: true, normalLength: 0.2 },
      PALETTE,
    )
    aids.dispose()

    expect(aids.object.children).toHaveLength(0)
  })

  // A box is decoration: left in the ray it would take every click meant for what it wraps — and
  // a line is met within a whole world unit of itself, so the halo would be the size of the box.
  it('takes its helpers out of the raycaster', () => {
    const aids = createViewportAids()
    const boxed = new Mesh(new BufferGeometry())
    aids.apply(new Map([['a', boxed]]), [], { ...OFF, boundingBoxes: 'all' }, PALETTE)

    const ray = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1))

    expect(ray.intersectObject(aids.object, true)).toEqual([])
  })
})
