import { describe, expect, it } from 'vitest'
import { DirectionalLight, Mesh, Object3D } from 'three'
import type { GeometryDescriptor, LightDescriptor } from '@shared/domain/scene'
import type { AssetPort } from '@game/ports/assetPort'
import { groupNode, lightNode, meshNode, modelNode } from '@/engines/scene/nodeFactory'
import { EMPTY_SCENE, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import { buildGameScene } from './gameScene'

const BOX: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }
const NOTHING: AssetPort = { urlOf: () => null }

const scene = (nodes: readonly SceneNode[]): SceneState => ({ ...EMPTY_SCENE, nodes: [...nodes] })

const SUN: LightDescriptor = {
  kind: 'directional',
  color: '#ffffff',
  intensity: 1,
  target: { x: 0, y: 0, z: 0 },
}

/**
 * 🛑 The editor puts a node's flags on the object that stands for it, lights included. The pass a
 * game ran walked MESHES alone: no light ever threw, so an exported game drew no shadow at all —
 * with `shadowMap.enabled` true, every material sampling a map nothing ever filled.
 */
describe('what an exported game throws a shadow with', () => {
  it('lets the light that carries the key of a scene throw one', async () => {
    const built = await buildGameScene(
      scene([meshNode(BOX, { name: 'Crate' }), lightNode(SUN, { x: 0, y: 4, z: 0 })]),
      NOTHING,
    )

    const light = [...built.byEntity.values()].find(one => one instanceof DirectionalLight)
    expect(light?.castShadow).toBe(true)
  })

  it('makes an imported model both throw and catch, as the same file does in the editor', async () => {
    const source = new Object3D()
    source.add(new Mesh())
    const node = modelNode('model-1', 'Model')
    const built = await buildGameScene(
      scene([node]),
      { urlOf: () => 'assets/model.glb' },
      undefined,
      undefined,
      async () => source,
    )

    const meshes: Mesh[] = []
    built.byEntity.get(node.id)?.traverse(one => {
      if (one instanceof Mesh) meshes.push(one)
    })
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every(one => one.castShadow && one.receiveShadow)).toBe(true)
  })

  it('leaves alone what the document says throws nothing', async () => {
    const node = { ...meshNode(BOX, { name: 'Crate' }), castShadow: false, receiveShadow: false }
    const built = await buildGameScene(scene([node]), NOTHING)

    const drawn = built.byEntity.get(node.id)
    expect(drawn?.castShadow).toBe(false)
    expect(drawn?.receiveShadow).toBe(false)
  })

  /**
   * A group's flags would otherwise be written over every node hanging under it. Declared BEFORE
   * its group on purpose: written in document order, the child's own pass puts them back, and the
   * defect only shows on the order the pass reaches the parent last.
   */
  it('stops at a child that stands for a node of its own', async () => {
    const parent = { ...groupNode(undefined, 'Set'), castShadow: true, receiveShadow: true }
    const child = {
      ...meshNode(BOX, { name: 'Crate' }),
      parentId: parent.id,
      castShadow: false,
      receiveShadow: false,
    }
    const built = await buildGameScene(scene([child, parent]), NOTHING)

    expect(built.byEntity.get(child.id)?.castShadow).toBe(false)
  })
})
