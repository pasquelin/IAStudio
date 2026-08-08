import {
  BoxGeometry,
  CompressedTexture,
  GridHelper,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Texture,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { applyWireOverlay } from './scene-view'
import { exportObjects, placedCopy } from './scene-export'

/** What a `.gltf` file holds, read back as the JSON it is — the point is to check the file. */
type GltfFile = {
  meshes?: { name?: string }[]
  nodes?: { name?: string }[]
}

async function gltfOf(objects: Parameters<typeof exportObjects>[0]): Promise<GltfFile> {
  const bytes = await exportObjects(objects, 'gltf')
  // `as`: what a `.gltf` file holds is glTF, and the two fields read here are the ones a reader
  // would look at. A guard would restate the schema to learn nothing more.
  return JSON.parse(new TextDecoder().decode(bytes)) as GltfFile
}

function named(name: string): Mesh {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  mesh.name = name
  return mesh
}

describe('exportObjects', () => {
  it('writes the objects it was handed', async () => {
    const file = await gltfOf([named('box-1')])

    expect(file.nodes?.map(node => node.name)).toContain('box-1')
  })

  it('writes several roots into one file', async () => {
    const file = await gltfOf([named('box-1'), named('box-2')])

    const names = file.nodes?.map(node => node.name) ?? []
    expect(names).toContain('box-1')
    expect(names).toContain('box-2')
  })

  it('carries what hangs from a root along with it', async () => {
    const root = named('parent')
    root.add(named('child'))

    const file = await gltfOf([root])

    expect(file.nodes?.map(node => node.name)).toContain('child')
  })

  /**
   * The whole point of the step, checked on the file rather than assumed: the grid, the
   * trihedron and the helpers are siblings of the nodes in the viewport, so handing over the
   * nodes leaves them out. A grid handed over would land in the file — this proves the
   * difference is the input, not luck.
   */
  it('leaves out what it was not handed, grid included', async () => {
    const viewport = new Scene()
    const grid = new GridHelper(10, 10)
    grid.name = 'grid'
    const mesh = named('box-1')
    // Siblings in one scene, exactly as the viewport holds them: only the mesh is handed over.
    viewport.add(grid, mesh)

    const file = await gltfOf([mesh])

    const names = file.nodes?.map(node => node.name) ?? []
    expect(names).toContain('box-1')
    expect(names).not.toContain('grid')
  })

  // The one thing that *is* a child of a mesh, and the one thing that would slip through.
  it('leaves the wireframe overlay out of the file', async () => {
    const mesh = named('box-1')
    applyWireOverlay(mesh, true, new LineBasicMaterial())
    expect(mesh.children).toHaveLength(1)

    const file = await gltfOf([mesh])

    expect(file.nodes?.map(node => node.name)).not.toContain('wireframe-overlay')
  })

  // Copies are handed over: the scene the user is looking at is not touched by an export.
  it('leaves the live objects exactly as they were', async () => {
    const mesh = named('box-1')
    applyWireOverlay(mesh, true, new LineBasicMaterial())
    mesh.position.set(1, 2, 3)

    await gltfOf([mesh])

    expect(mesh.children).toHaveLength(1)
    expect(mesh.position.toArray()).toEqual([1, 2, 3])
  })

  /**
   * The exporters write a *local* transform. Handed the object itself, a selected child would
   * land in the file where it sits inside its parent — at the origin here — rather than where it
   * sits in the scene.
   */
  it('writes a selected child where it stands in the world', async () => {
    const parent = named('parent')
    parent.position.set(10, 0, 0)
    const child = named('child')
    parent.add(child)

    const bytes = await exportObjects([child], 'gltf')
    // `as`: what a `.gltf` file holds is glTF, and these are the fields a reader looks at. The
    // exporter writes a column-major matrix rather than a translation, so x sits at index 12.
    const file = JSON.parse(new TextDecoder().decode(bytes)) as {
      nodes?: { name?: string; matrix?: number[]; translation?: number[] }[]
    }
    const node = file.nodes?.[0]

    expect(node?.translation?.[0] ?? node?.matrix?.[12]).toBe(10)
  })

  // `glb` is one binary file: it opens with the four bytes every reader looks for first.
  it('writes a binary glTF that says it is one', async () => {
    const bytes = await exportObjects([named('box-1')], 'glb')

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('glTF')
  })

  it('writes nothing at all for an empty selection', async () => {
    const file = await gltfOf([])

    expect(file.nodes ?? []).toEqual([])
  })
})

/**
 * KTX2 is wired into the model loader, so an imported model routinely wears textures glTF cannot
 * hold. Both exporters throw on one rather than skip it — the whole file is lost over a picture —
 * so the decoder the renderer supplies has to reach them.
 */
describe('exportObjects with a compressed texture', () => {
  function boxWearing(map: Texture): Mesh {
    const material = new MeshStandardMaterial()
    material.map = map
    return new Mesh(new BoxGeometry(), material)
  }

  /**
   * What is pinned is that the texture reaches the decoder instead of throwing at it. The export
   * cannot then finish: a decoded texture is canvas-backed, and jsdom encodes no canvas.
   */
  it('hands it to the decoder', async () => {
    const decompress = vi.fn(() => new Texture())
    const mesh = boxWearing(new CompressedTexture([], 4, 4))

    await exportObjects([mesh], 'gltf', { decompress }).catch(() => {})

    expect(decompress).toHaveBeenCalled()
  })

  // The default is the wired one, not none: an export must never be the exporter refusing to try.
  it('carries a decoder without being handed one', async () => {
    const mesh = boxWearing(new CompressedTexture([], 4, 4))

    const refusal = await exportObjects([mesh], 'gltf').then(
      () => '',
      (error: unknown) => String(error),
    )

    expect(refusal).not.toMatch(/setTextureUtils/)
  })
})

// `USDZExporter` takes one root; several are handed to it under a group of no consequence, and
// the file must hold them all the same.
describe('exportObjects to USDZ', () => {
  /**
   * Weighed rather than read: a USDZ is a zip of a binary USD crate, and the studio ships no
   * reader for one. What this pins is that both shapes reach the file — the geometry of a second
   * box is thousands of bytes, far more than the envelope a wrapping root adds.
   */
  it('writes one object, and writes several under a root of its own', async () => {
    const one = await exportObjects([named('box-1')], 'usdz')
    const two = await exportObjects([named('box-1'), named('box-2')], 'usdz')

    expect(one.byteLength).toBeGreaterThan(0)
    expect(two.byteLength).toBeGreaterThan(one.byteLength * 1.5)
  })
})

/**
 * `USDZExporter` reads `object.matrix` and never refreshes it (`USDZExporter.js:639`), where
 * `GLTFExporter` calls `updateMatrix` first (`GLTFExporter.js:2488`). Decomposing the world matrix
 * into position, quaternion and scale therefore reached one format and not the other: a selected
 * child came out of USDZ where it sits inside its parent, and the glTF test never saw it.
 */
describe('placedCopy', () => {
  it('leaves the copy a matrix that agrees with where it stands', () => {
    const parent = named('parent')
    parent.position.set(10, 0, 0)
    const child = named('child')
    parent.add(child)
    parent.updateMatrixWorld(true)

    const copy = placedCopy(child)

    // Column-major, so the translation sits at index 12.
    expect(copy.matrix.elements[12]).toBe(10)
    expect(copy.position.x).toBe(10)
  })
})
