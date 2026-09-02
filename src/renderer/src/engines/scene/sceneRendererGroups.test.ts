import { BatchedMesh, Group, InstancedMesh, Matrix4, type Object3D } from 'three'
import { byCodeUnit } from '@shared/text'
import { describe, expect, it } from 'vitest'
import { SceneRenderer, type GroupingStrategy } from './SceneRenderer'
import { directionalLight, gltfNodesOf, groupNodeFixture, meshNode } from './scene-fixtures'
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

describe.each(STRATEGIES)('the sources a %s group draws for, from outside the engine', grouping => {
  /** `as`: what a frame walks is the engine's own scene, and it is private by design. */
  const graphOf = (renderer: SceneRenderer): Object3D =>
    (renderer as unknown as { viewport: { scene: Object3D } }).viewport.scene

  const walked = (root: Object3D): Object3D[] => {
    const met: Object3D[] = []
    root.traverse(child => met.push(child))
    return met
  }

  /** Where the group put the body of one slot, along x. */
  const placedIn = (renderer: SceneRenderer, slot: number): number => {
    const held = new Matrix4()
    for (const child of graphOf(renderer).children) {
      if (child instanceof InstancedMesh) child.getMatrixAt(slot, held)
      else if (child instanceof BatchedMesh) child.getMatrixAt(slot, held)
      else continue
      return held.elements[12] ?? 0
    }
    throw new Error('nothing was grouped')
  }

  /** One group's worth of copies, all hanging from a crate — the shape a decor really has. */
  const inACrate = (): SceneNode[] => [
    groupNodeFixture('crate'),
    ...Array.from({ length: WORTH_INSTANCING }, (_unused, at) => ({
      ...meshNode(`c${at}`, 'crate'),
      transform: {
        position: { x: at * 5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    })),
  ]

  it('are no longer walked by a frame, which is what they cost', () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    const met = walked(graphOf(renderer)).map(object => object.name)
    for (const node of nodes.slice(1)) expect(met).not.toContain(node.id)
    expect(met).toContain('crate')
  })

  it('are still written to the file, under the node they hang from', async () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    const names = await namesOf(renderer)
    for (const node of nodes) expect(names).toContain(node.id)
  })

  it('are back out of the walk once the file is written', async () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })
    await namesOf(renderer)

    const met = walked(graphOf(renderer)).map(object => object.name)
    for (const node of nodes.slice(1)) expect(met).not.toContain(node.id)
  })

  // `both` and not `wireframe`: `showsEdges` draws the overlay for that one and, without quads,
  // leaves `wireframe` to the material's own flag — so the sources carry nothing to draw.
  it('stay in the walk while the edges are on, since they are what carries them', () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    renderer.setDisplayModes(['both'])

    const met = walked(graphOf(renderer)).map(object => object.name)
    for (const node of nodes.slice(1)) expect(met).toContain(node.id)
  })

  it('leave it again once the edges go', () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    renderer.setDisplayModes(['both'])
    renderer.setDisplayModes(['shaded'])

    const met = walked(graphOf(renderer)).map(object => object.name)
    for (const node of nodes.slice(1)) expect(met).not.toContain(node.id)
  })

  it('do not come back to it once their node is gone', () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    renderer.apply({ ...EMPTY_SCENE, nodes: nodes.filter(node => node.id !== 'c0') })
    renderer.setDisplayModes(['both'])

    expect(walked(graphOf(renderer)).map(object => object.name)).not.toContain('c0')
  })

  it('stand where a crate that MOVED puts them, which no walk refreshes any more', () => {
    const nodes = inACrate()
    const renderer = rendererOf(grouping)
    renderer.apply({ ...EMPTY_SCENE, nodes })

    const moved = nodes.map(node =>
      node.id === 'crate'
        ? { ...node, transform: { ...node.transform, position: { x: 100, y: 0, z: 0 } } }
        : node,
    )
    renderer.apply({ ...EMPTY_SCENE, nodes: moved })

    expect(placedIn(renderer, 3)).toBe(115)
  })
})
