import { BatchedMesh, Group, InstancedMesh, Matrix4, type Object3D } from 'three'
import { byCodeUnit } from '@shared/text'
import { describe, expect, it } from 'vitest'
import { SceneRenderer, type GroupingStrategy } from './SceneRenderer'
import { directionalLight, gltfNodesOf, meshNode } from './scene-fixtures'
import { WORTH_INSTANCING } from './grouping'
import { EMPTY_SCENE, type MeshNode, type SceneNode, type SceneState } from './sceneState'

/**
 * What a body drawn by something OTHER than itself must still answer to, seen from outside the
 * engine: the export, the graph after an edit and its undo, and where the copy stands.
 *
 * Under jsdom the renderer is never mounted: `apply` builds the whole graph and the grouping runs
 * on it, and only the drawing is missing.
 */

const STRATEGIES: GroupingStrategy[] = ['instanced', 'batched']

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

describe.each(STRATEGIES)('the copy a %s group draws', grouping => {
  /** Bodies laid along x, of one shape and one paint, so they all land in a single group. */
  const inARow = (count: number): SceneNode[] =>
    Array.from({ length: count }, (_unused, at) => ({
      ...meshNode(`r${at}`),
      transform: {
        position: { x: at * 5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    }))

  const placedAt = (renderer: SceneRenderer, slot: number): number => {
    // `as`: reaching for what the engine drew is the whole point, and it is private by design.
    const scene = (renderer as unknown as { viewport: { scene: Object3D } }).viewport.scene
    const held = new Matrix4()
    for (const child of scene.children) {
      if (child instanceof InstancedMesh) child.getMatrixAt(slot, held)
      else if (child instanceof BatchedMesh) child.getMatrixAt(slot, held)
      else continue
      return held.elements[12] ?? 0
    }
    throw new Error('nothing was grouped')
  }

  /**
   * A scene with NO directional light: the shadow pass is the one thing that used to refresh the
   * world matrices before the grouping copied them, so without a lamp every copy of a fresh
   * group was drawn at the origin — and nothing went red.
   */
  it('stands where its node does, in a scene no light refreshes', () => {
    const nodes = inARow(WORTH_INSTANCING)
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    expect(placedAt(renderer, 3)).toBe(15)
  })

  it('follows a placement typed rather than dragged', () => {
    const nodes = inARow(WORTH_INSTANCING)
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    const moved = nodes.map((node, at) =>
      at === 3
        ? { ...node, transform: { ...node.transform, position: { x: 900, y: 0, z: 0 } } }
        : node,
    )
    renderer.apply({ ...EMPTY_SCENE, nodes: moved })

    expect(placedAt(renderer, 3)).toBe(900)
  })
})
