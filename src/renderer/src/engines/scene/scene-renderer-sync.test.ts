import { BufferGeometry, Group, Material, Mesh, Object3D } from 'three'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { nodeIdOf, SceneRenderer } from './SceneRenderer'
import type { ModelSource } from './model-cache'
import { lightNodeFixture, meshNode, modelNodeFixture, spriteNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE, type SceneNode, type SceneState } from './scene-state'

/**
 * What an edit does to a scene already built — and, above all, what it frees. The renderer is
 * never mounted: everything below happens while the objects are assembled, which is the half a
 * test can reach and where every leak this file guards against would happen.
 *
 * Freeing is watched on the three.js prototypes rather than on the scene graph, which the engine
 * keeps to itself. It is also the honest place to watch it: what matters is that a buffer is
 * given back, not which object held it.
 */
const directional = () =>
  lightNodeFixture('light-1', {
    kind: 'directional',
    color: '#ffffff',
    intensity: 1,
    target: { x: 0, y: 0, z: 0 },
  })

describe('a scene told what changed', () => {
  let freedGeometries: ReturnType<typeof vi.spyOn>
  let freedMaterials: ReturnType<typeof vi.spyOn>
  let loadModel: Mock<ModelSource>

  beforeEach(() => {
    vi.restoreAllMocks()
    freedGeometries = vi.spyOn(BufferGeometry.prototype, 'dispose')
    freedMaterials = vi.spyOn(Material.prototype, 'dispose')
    loadModel = vi.fn<ModelSource>(async () => new Group())
  })

  const rendererOf = (...nodes: SceneNode[]): SceneRenderer => {
    const renderer = new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      loadModel,
    })
    renderer.apply({ ...EMPTY_SCENE, nodes })
    return renderer
  }

  const applied = (renderer: SceneRenderer, ...nodes: SceneNode[]): void => {
    const state: SceneState = { ...EMPTY_SCENE, nodes }
    renderer.apply(state)
  }

  const namesIn = async (renderer: SceneRenderer): Promise<string[]> => {
    const bytes = await renderer.exportTo('gltf', 'scene')
    // `as`: a `.gltf` file holds glTF, and `nodes` is the field a reader looks at first.
    const file = JSON.parse(new TextDecoder().decode(bytes)) as { nodes?: { name?: string }[] }
    return (file.nodes ?? []).flatMap(node => node.name ?? [])
  }

  describe('a node that goes away', () => {
    it('leaves the scene with it', async () => {
      const renderer = rendererOf(meshNode('box-1'), meshNode('box-2'))

      applied(renderer, meshNode('box-2'))

      expect(await namesIn(renderer)).toEqual(['box-2'])
    })

    it('gives back the buffer and the material of a mesh', () => {
      const renderer = rendererOf(meshNode('box-1'))
      freedGeometries.mockClear()
      freedMaterials.mockClear()

      applied(renderer)

      expect(freedGeometries).toHaveBeenCalled()
      expect(freedMaterials).toHaveBeenCalled()
    })

    /**
     * three.js shares one quad between every sprite ever built. Freeing it with the first sprite
     * removed would leave every other one drawing from a buffer that is gone.
     */
    it('gives back the material of a sprite but never its geometry', () => {
      const renderer = rendererOf(spriteNodeFixture('sprite-1'))
      freedGeometries.mockClear()
      freedMaterials.mockClear()

      applied(renderer)

      expect(freedMaterials).toHaveBeenCalled()
      expect(freedGeometries).not.toHaveBeenCalled()
    })

    /** A forgotten helper leaks a line geometry on every delete. */
    it('gives back the line buffer of a light helper', () => {
      const renderer = rendererOf(directional())
      freedGeometries.mockClear()

      applied(renderer)

      expect(freedGeometries).toHaveBeenCalled()
    })

    /**
     * The reference is keyed by what the node pointed at, and `applied` is the only thing that
     * remembers it — read after the map is emptied, the cache would keep the file alive forever.
     */
    it('gives its model back to the cache', async () => {
      const renderer = rendererOf(modelNodeFixture('model-1', 'asset-1'))
      await vi.waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))

      applied(renderer)
      applied(renderer, modelNodeFixture('model-2', 'asset-1'))

      // Loaded again rather than served from the cache: the first reference was given back.
      await vi.waitFor(() => expect(loadModel).toHaveBeenCalledTimes(2))
    })
  })

  describe('a model pointed somewhere else', () => {
    it('is fetched again rather than kept', async () => {
      const renderer = rendererOf(modelNodeFixture('model-1', 'asset-1'))
      await vi.waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))

      applied(renderer, modelNodeFixture('model-1', 'asset-2'))

      await vi.waitFor(() => expect(loadModel).toHaveBeenCalledTimes(2))
      expect(loadModel).toHaveBeenLastCalledWith(expect.stringContaining('asset-2'))
    })

    it('is left alone when it still points at the same file', async () => {
      const renderer = rendererOf(modelNodeFixture('model-1', 'asset-1'))
      await vi.waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))

      applied(renderer, { ...modelNodeFixture('model-1', 'asset-1'), name: 'renamed' })

      expect(loadModel).toHaveBeenCalledTimes(1)
    })
  })

  describe('an edit to what a node is made of', () => {
    const fileOf = async (renderer: SceneRenderer): Promise<string> => {
      const bytes = await renderer.exportTo('gltf', 'scene')
      return new TextDecoder().decode(bytes)
    }

    it('replaces the shape when the geometry changes', async () => {
      const box = meshNode('box-1')
      const renderer = rendererOf(box)
      const before = await fileOf(renderer)

      applied(renderer, {
        ...box,
        geometry: { kind: 'sphere', radius: 1, widthSegments: 16, heightSegments: 12 },
      })

      expect(await fileOf(renderer)).not.toEqual(before)
    })

    it('carries the material through to the file', async () => {
      const box = meshNode('box-1')
      const renderer = rendererOf(box)

      applied(renderer, { ...box, material: { ...box.material, color: '#ff0000' } })

      // A mesh whose material was never applied exports with none at all: glTF writes no
      // `baseColorFactor` for a node it has no material for.
      expect(await fileOf(renderer)).toContain('baseColorFactor')
    })
  })

  describe('a child whose parent arrives later', () => {
    /**
     * Nodes arrive in document order, and nothing promises a parent comes first. What the export
     * shows is the hanging itself: a child whose parent is going out too travels *inside* it, so
     * it only appears at all if it was actually hung there.
     */
    it('joins its parent on the sync that builds it', async () => {
      const child = meshNode('child-1', 'parent-1')
      const renderer = rendererOf(child)

      expect(await namesIn(renderer)).toEqual(['child-1'])

      applied(renderer, child, meshNode('parent-1'))

      expect((await namesIn(renderer)).sort()).toEqual(['child-1', 'parent-1'])
    })
  })

  describe('finding which node was clicked', () => {
    const known = (name: string): boolean => name === 'box-1'

    it('answers with the node itself', () => {
      const object = new Object3D()
      object.name = 'box-1'

      expect(nodeIdOf(object, known)).toBe('box-1')
    })

    /**
     * A ray meets a helper's child, or one of the hundred meshes a GLB brought — and
     * `GLTFLoader` names every one of them, so a name alone proves nothing.
     */
    it('walks up from a child the loader named', () => {
      const node = new Object3D()
      node.name = 'box-1'
      const fromTheFile = new Mesh()
      fromTheFile.name = 'Cube.001'
      node.add(fromTheFile)

      expect(nodeIdOf(fromTheFile, known)).toBe('box-1')
    })

    it('answers nothing for an object the scene never heard of', () => {
      const stray = new Object3D()
      stray.name = 'Cube.001'

      expect(nodeIdOf(stray, known)).toBeNull()
    })

    it('answers nothing for an object with no name at all', () => {
      expect(nodeIdOf(new Object3D(), known)).toBeNull()
    })
  })
})
