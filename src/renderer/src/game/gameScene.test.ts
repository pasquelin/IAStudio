import { describe, expect, it } from 'vitest'
import { Mesh } from 'three'
import type { MeshStandardMaterial } from 'three'
import type { GeometryDescriptor } from '@shared/domain/scene'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import type { AssetPort } from '@game/ports/assetPort'
import { groupNode, lightNode, meshNode } from '@/engines/scene/nodeFactory'
import { EMPTY_SCENE, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import { buildGameScene } from './gameScene'

const NOTHING: AssetPort = { urlOf: () => null }
const BOX: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }

const scene = (nodes: readonly SceneNode[]): SceneState => ({ ...EMPTY_SCENE, nodes: [...nodes] })

describe('a scene as a game draws it', () => {
  /** 🛑 No gizmo, no helper, no grid: what a game draws is the shapes and the lights. */
  it('makes an object for a shape and for a light, and none for a camera', () => {
    const built = buildGameScene(
      scene([
        meshNode(BOX, { name: 'Crate' }),
        lightNode({ kind: 'ambient', color: '#ffffff', intensity: 1 }, { x: 0, y: 1, z: 0 }),
      ]),
      NOTHING,
    )

    expect([...built.byEntity.values()].map(one => one.type)).toEqual(['Mesh', 'AmbientLight'])
  })

  /** A child declared before its group would otherwise land at the root, and stay there. */
  it('hangs a child under its group, whichever was declared first', () => {
    const group = groupNode(undefined, 'Ground')
    const child = { ...meshNode(BOX), parentId: group.id }
    const built = buildGameScene(scene([child, group]), NOTHING)

    expect(built.byEntity.get(child.id)?.parent).toBe(built.byEntity.get(group.id))
  })

  it('puts each object where its node stands', () => {
    const node = {
      ...meshNode(BOX),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 3, y: 2, z: -1 } },
    }
    const built = buildGameScene(scene([node]), NOTHING)

    expect(built.byEntity.get(node.id)?.position.toArray()).toEqual([3, 2, -1])
  })

  /** A game has no picture for a texture the project has lost, and draws the shape all the same. */
  it('draws a shape whose texture nothing resolves, with no map on it', () => {
    const node = meshNode(BOX)
    const lost: SceneNode =
      node.type === 'mesh'
        ? { ...node, material: { ...node.material, map: { assetId: 'x' } } }
        : node
    const built = buildGameScene(scene([lost]), NOTHING)
    const mesh = built.byEntity.get(node.id)

    expect(mesh).toBeInstanceOf(Mesh)
    expect(mesh instanceof Mesh && (mesh.material as MeshStandardMaterial).map).toBeNull()
  })

  it('paints the background a scene asked for', () => {
    const built = buildGameScene(
      {
        ...EMPTY_SCENE,
        world: { ...EMPTY_SCENE.world, background: { kind: 'color', color: '#102030' } },
      },
      NOTHING,
    )

    expect(built.scene.background).not.toBeNull()
  })
})
