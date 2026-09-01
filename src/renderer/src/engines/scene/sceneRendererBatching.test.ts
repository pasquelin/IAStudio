import { Group } from 'three'
import { byCodeUnit } from '@shared/text'
import { describe, expect, it } from 'vitest'
import { SceneRenderer, type GroupingStrategy } from './SceneRenderer'
import { directionalLight, gltfNodesOf, meshNode } from './scene-fixtures'
import { EMPTY_SCENE, type MeshNode, type SceneNode, type SceneState } from './sceneState'

/**
 * What a body drawn BY A LOT must still answer to, seen from outside the engine: the export, and
 * the graph after an edit and its undo. The lots are one `BatchedMesh` per material, so two
 * shapes wearing one paint land in the same lot — which the instanced path never did.
 *
 * Under jsdom the renderer is never mounted: `apply` builds the whole graph and the grouping runs
 * on it, and only the drawing is missing.
 */

const GROUP_SIZES = [4, 12, 20, 45, 60]

/** One group per size, two shapes each, one paint per group: five paints, two shapes apiece. */
function bodies(): MeshNode[] {
  const nodes: MeshNode[] = []
  let at = 0
  for (const [group, size] of GROUP_SIZES.entries()) {
    for (let copy = 0; copy < size; copy++) {
      const node = meshNode(`g${group}_${copy}`)
      nodes.push({
        ...node,
        geometry:
          copy % 2 === 0
            ? node.geometry
            : { kind: 'sphere', radius: 0.5, widthSegments: 8, heightSegments: 6 },
        material: { ...node.material, roughness: 0.1 * group, color: `#00${group}${group}ff` },
        transform: { ...node.transform, position: { x: at * 2, y: 0, z: group * 3 } },
      })
      at++
    }
  }
  return nodes
}

const sceneOf = (nodes: SceneNode[]): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [directionalLight('sun'), ...nodes],
})

const rendererOf = (grouping: GroupingStrategy = 'batched'): SceneRenderer =>
  new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    grouping,
    loadModel: async () => new Group(),
  })

const fileOf = async (renderer: SceneRenderer): Promise<string> =>
  new TextDecoder().decode(await renderer.exportTo('gltf', 'scene'))

const namesOf = async (renderer: SceneRenderer): Promise<string[]> =>
  (await gltfNodesOf(renderer)).flatMap(node => node.name ?? [])

describe('editing a body a lot draws', () => {
  it('exports the scene with every body, whatever draws it', async () => {
    const nodes = bodies()
    const renderer = rendererOf()
    renderer.apply(sceneOf(nodes))

    const names = await namesOf(renderer)
    for (const node of nodes) expect(names).toContain(node.id)
  })

  it('exports the same file as the instanced path, since the sources are what is exported', async () => {
    const nodes = bodies()
    const batched = rendererOf('batched')
    batched.apply(sceneOf(nodes))
    const instanced = rendererOf('instanced')
    instanced.apply(sceneOf(nodes))

    expect(await fileOf(batched)).toEqual(await fileOf(instanced))
  })

  it('lands on the same graph whether a body moved then came back, or never moved', async () => {
    const nodes = bodies()
    const settled = sceneOf(nodes)
    const moved = sceneOf(
      nodes.map(node =>
        node.id === 'g4_3'
          ? { ...node, transform: { ...node.transform, position: { x: 900, y: 5, z: 5 } } }
          : node,
      ),
    )

    const edited = rendererOf()
    edited.apply(settled)
    edited.apply(moved)
    edited.apply(settled)

    const straight = rendererOf()
    straight.apply(settled)

    expect(await fileOf(edited)).toEqual(await fileOf(straight))
  })

  it('holds every body again once a removed one is restored', async () => {
    const nodes = bodies()
    const settled = sceneOf(nodes)
    const without = sceneOf(nodes.filter(node => node.id !== 'g4_3'))

    const edited = rendererOf()
    edited.apply(settled)
    edited.apply(without)
    edited.apply(settled)

    const straight = rendererOf()
    straight.apply(settled)

    expect((await namesOf(edited)).sort(byCodeUnit)).toEqual(
      (await namesOf(straight)).sort(byCodeUnit),
    )
  })
})
