import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { carriesNoNode, heldOutOfDraw, unhang } from './grouping'

const bodyIn = (parent: Object3D): Mesh => {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial())
  parent.add(mesh)
  return mesh
}

/** What a walk of the tree actually meets — the one question this module exists to answer. */
const walked = (root: Object3D): Object3D[] => {
  const met: Object3D[] = []
  root.traverse(child => met.push(child))
  return met
}

describe('holding the sources of a group out of the walk', () => {
  it('takes a source out of what a walk of the scene meets', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)

    heldOutOfDraw().hold([mesh])

    expect(walked(scene)).not.toContain(mesh)
  })

  it('leaves it hanging from the node it belongs to, which is what answers upward', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)

    heldOutOfDraw().hold([mesh])

    expect(mesh.parent).toBe(scene)
  })

  it('hangs it back where a walk meets it again', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)
    const held = heldOutOfDraw()

    held.hold([mesh])
    held.hang()

    expect(walked(scene)).toContain(mesh)
  })

  it('hangs it once, however many times it is asked', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)
    const held = heldOutOfDraw()

    held.hold([mesh])
    held.hang()
    held.hang()

    expect(scene.children.filter(child => child === mesh)).toHaveLength(1)
  })

  it('gives the previous set back when a rebuild settles on another one', () => {
    const scene = new Object3D()
    const first = bodyIn(scene)
    const second = bodyIn(scene)
    const held = heldOutOfDraw()

    held.hold([first])
    held.hold([second])

    expect(walked(scene)).toContain(first)
    expect(walked(scene)).not.toContain(second)
  })

  it('takes them out again after a caller has read the tree', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)
    const held = heldOutOfDraw()

    held.hold([mesh])
    held.hang()
    held.drop()

    expect(walked(scene)).not.toContain(mesh)
  })

  it('leaves alone a source a gesture carried under the pivot', () => {
    const scene = new Object3D()
    const pivot = new Object3D()
    scene.add(pivot)
    const mesh = bodyIn(scene)
    const held = heldOutOfDraw()

    held.hold([mesh])
    pivot.attach(mesh)
    held.hang()

    expect(scene.children).not.toContain(mesh)
    expect(pivot.children.filter(child => child === mesh)).toHaveLength(1)
  })

  it('puts back nothing for a source released while it was out', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)
    const held = heldOutOfDraw()

    held.hold([mesh])
    mesh.parent = null
    held.hang()

    expect(scene.children).not.toContain(mesh)
  })
})

describe('the world matrices no walk reaches any more', () => {
  it('are composed against the parent, as a walk of the scene would have', () => {
    const scene = new Object3D()
    const crate = new Object3D()
    scene.add(crate)
    const mesh = bodyIn(crate)
    mesh.position.set(2, 0, 0)
    const held = heldOutOfDraw()
    held.hold([mesh])

    crate.position.set(10, 0, 0)
    scene.updateMatrixWorld()
    held.refresh()

    expect(mesh.matrixWorld.elements[12]).toBe(12)
  })
})

describe('unhang', () => {
  it('keeps a released source from being hung back by the next rebuild', () => {
    const scene = new Object3D()
    const mesh = bodyIn(scene)
    const held = heldOutOfDraw()
    held.hold([mesh])

    unhang(mesh)
    held.hang()

    expect(scene.children).not.toContain(mesh)
    expect(mesh.parent).toBeNull()
  })
})

describe('carriesNoNode', () => {
  it('lets a bare source leave the walk', () => {
    const mesh = bodyIn(new Object3D())

    expect(carriesNoNode(mesh, () => undefined)).toBe(true)
  })

  it('lets one wearing an overlay leave it too', () => {
    const mesh = bodyIn(new Object3D())
    const overlay = new Object3D()
    overlay.name = 'edges'
    mesh.add(overlay)

    expect(carriesNoNode(mesh, () => undefined)).toBe(true)
  })

  it('keeps in the walk a source another node hangs from', () => {
    const mesh = bodyIn(new Object3D())
    const child = new Object3D()
    child.name = 'n7'
    mesh.add(child)

    expect(carriesNoNode(mesh, id => (id === 'n7' ? child : undefined))).toBe(false)
  })
})
