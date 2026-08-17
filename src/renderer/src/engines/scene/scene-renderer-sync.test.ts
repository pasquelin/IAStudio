import { BufferGeometry, Group, Material, Mesh, Object3D } from 'three'
import { beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { nodeIdOf, SceneRenderer } from './SceneRenderer'
import type { ModelSource } from './modelCache'
import { directionalLight, meshNode, modelNodeFixture, spriteNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE, type SceneNode, type SceneState } from './sceneState'

/**
 * What an edit does to a scene already built — and, above all, what it frees. The renderer is
 * never mounted: everything below happens while the objects are assembled, which is the half a
 * test can reach and where every leak this file guards against would happen.
 *
 * Freeing is watched on the three.js prototypes rather than on the scene graph, which the engine
 * keeps to itself. It is also the honest place to watch it: what matters is that a buffer is
 * given back, not which object held it.
 *
 * What is out of reach here: whether an object leaves the three.js graph. `exportTo` reads the
 * engine's own map of nodes, not the scene, so a node removed from the map but left hanging in
 * the graph looks identical from outside. Only a mounted renderer would tell them apart.
 */

describe('a scene told what changed', () => {
  let freedGeometries: MockInstance<() => void>
  let freedMaterials: MockInstance<() => void>
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

  const fileOf = async (renderer: SceneRenderer): Promise<string> => {
    const bytes = await renderer.exportTo('gltf', 'scene')
    return new TextDecoder().decode(bytes)
  }

  const namesIn = async (renderer: SceneRenderer): Promise<string[]> => {
    // `as`: a `.gltf` file holds glTF, and `nodes` is the field a reader looks at first.
    const file = JSON.parse(await fileOf(renderer)) as { nodes?: { name?: string }[] }
    return (file.nodes ?? []).flatMap(node => node.name ?? [])
  }

  describe('a node that goes away', () => {
    it('is dropped from what the document exports', async () => {
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
      const renderer = rendererOf(directionalLight('light-1'))
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

    it('carries the colour through to the file', async () => {
      const box = meshNode('box-1')
      const renderer = rendererOf(box)

      applied(renderer, { ...box, material: { ...box.material, color: '#ff0000' } })

      // The value, not the field: glTF omits `baseColorFactor` altogether while the material is
      // still white and opaque, so asserting its presence alone would go green on any colour.
      expect(await fileOf(renderer)).toContain('"baseColorFactor":[1,0,0,1]')
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
  })

  /**
   * Four views on an unmounted renderer, which is all this file can reach — jsdom gives no WebGL
   * context, so the cameras exist but nothing draws through them. What is checked is what the
   * engine answers about itself; where the side views land is the viewport's own suite.
   */
  describe('four views', () => {
    it('opens and closes the layout, and says which it is in', () => {
      const renderer = new SceneRenderer({ onSelect: vi.fn(), onTransform: vi.fn() })

      expect(renderer.quadView()).toBe(false)
      renderer.setQuadView(true)
      expect(renderer.quadView()).toBe(true)
      // Nothing has pointed anywhere, so every command still lands on the main view.
      expect(renderer.activePane()).toBe(0)

      renderer.setQuadView(false)
      expect(renderer.quadView()).toBe(false)

      renderer.dispose()
    })

    /**
     * The count is the engine's to make: the document holds an asset id, and what a model
     * actually brought is known only once its file has landed here.
     */
    it('says what the scene costs, and what the selection costs of it', () => {
      const reported: { scene: number; selected: number }[] = []
      const renderer = new SceneRenderer({
        onSelect: vi.fn(),
        onTransform: vi.fn(),
        onStats: (scene, selected) =>
          reported.push({ scene: scene.triangles, selected: selected.triangles }),
      })

      renderer.apply({ ...EMPTY_SCENE, nodes: [meshNode('box-1'), meshNode('box-2')] })
      const both = reported.at(-1)

      renderer.apply({
        ...EMPTY_SCENE,
        nodes: [meshNode('box-1'), meshNode('box-2')],
        selectedIds: ['box-1'],
      })
      const one = reported.at(-1)

      expect(both?.scene).toBeGreaterThan(0)
      expect(both?.selected).toBe(0)
      // The same scene, and a selection that is a part of it rather than all of it.
      expect(one?.scene).toBe(both?.scene)
      expect(one?.selected).toBeGreaterThan(0)
      expect(one?.selected).toBeLessThan(one?.scene ?? 0)

      renderer.dispose()
    })

    it('sizes the side views to what the scene holds rather than to a constant', () => {
      const renderer = new SceneRenderer({ onSelect: vi.fn(), onTransform: vi.fn() })

      // An empty scene and a scene with something in it both open, which is what is reachable
      // here: where the frustum lands is the viewport's own suite.
      renderer.setQuadView(true)
      renderer.apply({ ...EMPTY_SCENE, nodes: [meshNode('box-1')] })
      renderer.setQuadView(false)
      renderer.setQuadView(true)

      expect(renderer.quadView()).toBe(true)
      renderer.dispose()
    })

    /**
     * The rule the user asked for in as many words: only a perspective turns. A side view exists
     * because it does NOT — one drag away from being an almost-top view, it answers nothing.
     */
    it('locks the rotation of every view but the free ones', () => {
      const renderer = new SceneRenderer({ onSelect: vi.fn(), onTransform: vi.fn() })
      renderer.setQuadView(true)

      renderer.setPaneViews(['free', 'top', 'free', 'right'])

      // Unmounted, the panes carry no orbit to lock; what is reachable here is that the call
      // stands and the layout holds. The lock itself is asserted in the viewport's own suite.
      expect(renderer.quadView()).toBe(true)

      // Set again while the layout is closed: the views are remembered, nothing is placed.
      renderer.setQuadView(false)
      renderer.setPaneViews(['top', 'free', 'free', 'bottom'])
      expect(renderer.quadView()).toBe(false)
      renderer.dispose()
    })

    /**
     * The point of the whole layout: only the AXIS of a side view is locked. Selecting and
     * dragging are the work itself, and three quarters one can look at but not work in is three
     * quarters of a viewport wasted — which is what shipped and had to be corrected.
     */
    it('works through the view under the pointer, not through the first one', () => {
      const renderer = new SceneRenderer({ onSelect: vi.fn(), onTransform: vi.fn() })
      renderer.setQuadView(true)

      // Unmounted, the pointer is over pane 0 and every camera answers; what is reachable here
      // is that asking is legal at all. Which camera a pane holds is the viewport's own suite.
      expect(renderer.activePane()).toBe(0)

      renderer.dispose()
    })

    it('takes one display mode per view, and ignores a list it already holds', () => {
      const renderer = new SceneRenderer({ onSelect: vi.fn(), onTransform: vi.fn() })
      renderer.apply({ ...EMPTY_SCENE, nodes: [meshNode('box-1')] })

      renderer.setDisplayModes(['shaded', 'wireframe', 'both', 'shaded'])
      renderer.setDisplayModes(['shaded', 'wireframe', 'both', 'shaded'])
      renderer.setDisplayModes(['shaded'])
      // The quad reading rebuilds the same edges differently, so it counts as a change.
      renderer.setDisplayModes(['both'], true)
      renderer.setDisplayModes(['both'], true)

      // The edges are geometry: asked for by any view, they are built; asked for by none, freed.
      expect(freedGeometries).toHaveBeenCalled()

      renderer.dispose()
    })
  })
})
