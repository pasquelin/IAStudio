import { describe, expect, it } from 'vitest'
import { BatchedMesh, InstancedMesh, Matrix4, Mesh } from 'three'
import type { MeshStandardMaterial } from 'three'
import type { GeometryDescriptor } from '@shared/domain/scene'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import type { AssetPort } from '@game/ports/assetPort'
import { csgPartOf, type CsgGraph } from '@shared/domain/csg'
import { carvedNode, groupNode, lightNode, meshNode } from '@/engines/scene/nodeFactory'
import {
  DEFAULT_MATERIAL,
  EMPTY_SCENE,
  type SceneNode,
  type SceneState,
} from '@/engines/scene/sceneState'
import { colliderFromNode } from './colliderFromNode'
import { buildGameScene } from './gameScene'
import { WORTH_INSTANCING } from '@/engines/scene/grouping'

const NOTHING: AssetPort = { urlOf: () => null }
const BOX: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }

const scene = (nodes: readonly SceneNode[]): SceneState => ({ ...EMPTY_SCENE, nodes: [...nodes] })

describe('a scene as a game draws it', () => {
  /** 🛑 No gizmo, no helper, no grid: what a game draws is the shapes and the lights. */
  it('makes an object for a shape and for a light, and none for a camera', async () => {
    const built = await buildGameScene(
      scene([
        meshNode(BOX, { name: 'Crate' }),
        lightNode({ kind: 'ambient', color: '#ffffff', intensity: 1 }, { x: 0, y: 1, z: 0 }),
      ]),
      NOTHING,
    )

    expect([...built.byEntity.values()].map(one => one.type)).toEqual(['Mesh', 'AmbientLight'])
  })

  /** A child declared before its group would otherwise land at the root, and stay there. */
  it('hangs a child under its group, whichever was declared first', async () => {
    const group = groupNode(undefined, 'Ground')
    const child = { ...meshNode(BOX), parentId: group.id }
    const built = await buildGameScene(scene([child, group]), NOTHING)

    expect(built.byEntity.get(child.id)?.parent).toBe(built.byEntity.get(group.id))
  })

  it('puts each object where its node stands', async () => {
    const node = {
      ...meshNode(BOX),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 3, y: 2, z: -1 } },
    }
    const built = await buildGameScene(scene([node]), NOTHING)

    expect(built.byEntity.get(node.id)?.position.toArray()).toEqual([3, 2, -1])
  })

  it('draws repeated static shapes as spatial instances while keeping every logical entity', async () => {
    const nodes = Array.from({ length: WORTH_INSTANCING }, (_unused, index) =>
      meshNode(BOX, { name: `Crate ${index}` }),
    )

    const built = await buildGameScene(scene(nodes), NOTHING)
    const instances: InstancedMesh[] = []
    built.scene.traverse(object => {
      if (object instanceof InstancedMesh) instances.push(object)
    })

    expect(instances.reduce((count, instance) => count + instance.count, 0)).toBe(WORTH_INSTANCING)
    expect(instances.length).toBeLessThan(WORTH_INSTANCING)
    expect(nodes.every(node => built.byEntity.has(node.id))).toBe(true)
  })

  it('keeps a gameplay-driven repetition individual', async () => {
    const staticNodes = Array.from({ length: WORTH_INSTANCING }, (_unused, index) =>
      meshNode(BOX, { name: `Static crate ${index}` }),
    )
    const moving: SceneNode = {
      ...meshNode(BOX, { name: 'Moving crate' }),
      components: [{ type: 'Spin' }],
    }

    const built = await buildGameScene(scene([...staticNodes, moving]), NOTHING)
    const instances: InstancedMesh[] = []
    built.scene.traverse(object => {
      if (object instanceof InstancedMesh) instances.push(object)
    })

    expect(instances.reduce((count, instance) => count + instance.count, 0)).toBe(WORTH_INSTANCING)
    expect(built.byEntity.get(moving.id)?.parent).toBe(built.scene)
  })

  it('draws different compatible shapes through BatchedMesh when the author forces a batch', async () => {
    const nodes: SceneNode[] = [
      { ...meshNode(BOX), optimization: { mode: 'batch' } },
      {
        ...meshNode({ kind: 'box', width: 2, height: 1, depth: 1 }),
        optimization: { mode: 'batch' },
      },
    ]
    const built = await buildGameScene(scene(nodes), NOTHING)
    const batches: BatchedMesh[] = []
    built.scene.traverse(object => {
      if (object instanceof BatchedMesh) batches.push(object)
    })

    expect(batches).toHaveLength(1)
    expect(batches[0]?.instanceCount).toBe(2)
    expect(nodes.every(node => built.byEntity.has(node.id))).toBe(true)
    expect(
      built.scene.children.some(child => nodes.some(node => built.byEntity.get(node.id) === child)),
    ).toBe(false)
  })

  it('draws a baked authoring group as one InstancedMesh', async () => {
    const base = meshNode(BOX, { name: 'Baked crates' })
    if (base.type !== 'mesh') throw new Error('expected a mesh fixture')
    const node: SceneNode = {
      ...base,
      optimization: { mode: 'exclude' },
      instances: [
        { sourceId: 'first', name: 'First', transform: IDENTITY_TRANSFORM },
        {
          sourceId: 'second',
          name: 'Second',
          transform: { ...IDENTITY_TRANSFORM, position: { x: 3, y: 0, z: 0 } },
        },
      ],
    }
    const built = await buildGameScene(scene([node]), NOTHING)
    const rendered = built.byEntity.get(node.id)

    expect(rendered).toBeInstanceOf(InstancedMesh)
    expect(rendered instanceof InstancedMesh ? rendered.count : 0).toBe(2)
    expect(built.byEntity.get('first')).toBe(rendered)
    built.place('second', {
      ...IDENTITY_TRANSFORM,
      position: { x: 7, y: 1, z: -2 },
    })
    const matrix = new Matrix4()
    if (rendered instanceof InstancedMesh) rendered.getMatrixAt(1, matrix)
    expect(matrix.elements.slice(12, 15)).toEqual([7, 1, -2])
  })

  /** A game has no picture for a texture the project has lost, and draws the shape all the same. */
  it('draws a shape whose texture nothing resolves, with no map on it', async () => {
    const node = meshNode(BOX)
    const lost: SceneNode =
      node.type === 'mesh'
        ? { ...node, material: { ...node.material, map: { assetId: 'x' } } }
        : node
    const built = await buildGameScene(scene([lost]), NOTHING)
    const mesh = built.byEntity.get(node.id)

    expect(mesh).toBeInstanceOf(Mesh)
    expect(mesh instanceof Mesh && (mesh.material as MeshStandardMaterial).map).toBeNull()
  })

  /** 🛑 What a game FEELS, it DRAWS: a kind left out of the graph is a wall the player is
   * blocked by and cannot see. */
  it('draws a carved solid, which the physics already feels', async () => {
    const node = carvedNode(pierced())
    const built = await buildGameScene(scene([node]), NOTHING)
    const object = built.byEntity.get(node.id)

    if (!(object instanceof Mesh)) throw new Error('expected a mesh')

    expect(colliderFromNode(node)).not.toBeNull()
    expect(object.geometry.getAttribute('position').count).toBeGreaterThan(0)
  })

  it('paints the background a scene asked for', async () => {
    const built = await buildGameScene(
      {
        ...EMPTY_SCENE,
        world: { ...EMPTY_SCENE.world, background: { kind: 'color', color: '#102030' } },
      },
      NOTHING,
    )

    expect(built.scene.background).not.toBeNull()
  })
})

/** A wall with a window taken out of it — the shape a game is asked to draw and to be stopped by. */
function pierced(): CsgGraph {
  return {
    base: csgPartOf('Wall', { kind: 'box', width: 4, height: 3, depth: 0.2 }, DEFAULT_MATERIAL),
    steps: [
      {
        operation: 'subtract',
        part: csgPartOf('Window', { kind: 'box', width: 1, height: 1, depth: 1 }, DEFAULT_MATERIAL),
      },
    ],
    collision: 'hull',
  }
}
