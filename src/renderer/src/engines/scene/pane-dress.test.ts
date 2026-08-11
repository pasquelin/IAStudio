import { BoxGeometry, DirectionalLight, Layers, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPaneMemory, dressForPane, type PaneEye } from './pane-dress'
import { createPaneMaterials, type PaneMaterials } from './pane-materials'
import { EDGE_LAYER } from './scene-view'

/** A camera reduced to what dressing a view actually reads of one. */
function eye(): PaneEye & { layers: Layers } {
  return { layers: new Layers() }
}

describe('dressing a view before it is drawn', () => {
  let materials: PaneMaterials
  let memory: ReturnType<typeof createPaneMemory>

  beforeEach(() => {
    materials = createPaneMaterials()
    memory = createPaneMemory()
  })

  const cube = (): Mesh => new Mesh(new BoxGeometry(), new MeshStandardMaterial())

  it('leaves the real materials alone in a shaded view', () => {
    const mesh = cube()
    const own = mesh.material

    dressForPane([mesh], 'shaded', false, materials, memory, eye())

    expect(mesh.material).toBe(own)
  })

  it('paints every surface with one stand-in in a solid view, and gives them back after', () => {
    const mesh = cube()
    const own = mesh.material

    dressForPane([mesh], 'solid', false, materials, memory, eye())
    expect(mesh.material).not.toBe(own)

    dressForPane([mesh], 'shaded', false, materials, memory, eye())
    expect(mesh.material).toBe(own)
  })

  /** The trap the memory exists for: a second pass must not remember the first pass's clay. */
  it('never mistakes a previous pass for the model own material', () => {
    const mesh = cube()
    const own = mesh.material

    dressForPane([mesh], 'solid', false, materials, memory, eye())
    dressForPane([mesh], 'matcap', false, materials, memory, eye())
    dressForPane([mesh], 'shaded', false, materials, memory, eye())

    expect(mesh.material).toBe(own)
  })

  it('puts the scene lights out for the material preview, and back afterwards', () => {
    const light = new DirectionalLight()

    dressForPane([light], 'material', false, materials, memory, eye())
    expect(light.visible).toBe(false)

    dressForPane([light], 'shaded', false, materials, memory, eye())
    expect(light.visible).toBe(true)
  })

  it('leaves a light the document itself hides hidden', () => {
    const light = new DirectionalLight()
    light.visible = false

    dressForPane([light], 'material', false, materials, memory, eye())
    dressForPane([light], 'shaded', false, materials, memory, eye())

    expect(light.visible).toBe(false)
  })

  it('shows the edge overlay to the view that asked for it, and to no other', () => {
    const both = eye()
    const shaded = eye()

    dressForPane([cube()], 'both', false, materials, memory, both)
    dressForPane([cube()], 'shaded', false, materials, memory, shaded)

    expect(both.layers.isEnabled(EDGE_LAYER)).toBe(true)
    expect(shaded.layers.isEnabled(EDGE_LAYER)).toBe(false)
  })

  /**
   * A wireframe read as quads is its overlay and nothing else: the material's own flag draws
   * every triangle, diagonals included, which is exactly what the quad reading removes.
   */
  it('hides the surfaces of a wireframe view asked for quads, and shows its edges', () => {
    const mesh = cube()
    const camera = eye()

    dressForPane([mesh], 'wireframe', true, materials, memory, camera)

    expect(camera.layers.isEnabled(EDGE_LAYER)).toBe(true)
    expect(mesh.material).not.toBe(new MeshStandardMaterial())
    expect(Array.isArray(mesh.material) ? false : mesh.material.visible).toBe(false)
  })

  it('keeps the surfaces of a wireframe view reading triangles', () => {
    const mesh = cube()
    const own = mesh.material
    const camera = eye()

    dressForPane([mesh], 'wireframe', false, materials, memory, camera)

    expect(mesh.material).toBe(own)
    expect(camera.layers.isEnabled(EDGE_LAYER)).toBe(false)
  })

  it('colours by density, so the crowded object and the plain one differ', () => {
    const dense = new Mesh(new BoxGeometry(0.1, 0.1, 0.1, 8, 8, 8), new MeshStandardMaterial())
    const plain = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial())

    dressForPane([dense, plain], 'density', false, materials, memory, eye())

    expect(dense.material).not.toBe(plain.material)
  })

  it('walks a model, which arrives as a tree rather than a mesh', () => {
    const model = new Object3D()
    const inside = cube()
    model.add(inside)
    const own = inside.material

    dressForPane([model], 'solid', false, materials, memory, eye())

    expect(inside.material).not.toBe(own)
  })
})
