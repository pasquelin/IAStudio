import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { Box3, DirectionalLight, Mesh, Object3D, PerspectiveCamera, Vector3 } from 'three'
import type { LightDescriptor } from '@shared/domain/scene'
import { groupNode, lightNode, meshNode, modelNode } from '@/engines/scene/nodeFactory'
import { BOX, NOTHING, sceneOf } from './game-fixtures'
import { buildGameScene } from './gameScene'
import { gameShadowReach } from './gameSceneShadows'
import { fitShadowCamera } from '@/engines/scene/shadows'

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
      sceneOf([meshNode(BOX, { name: 'Crate' }), lightNode(SUN, { x: 0, y: 4, z: 0 })]),
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
      sceneOf([node]),
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

  /**
   * three.js aims a directional shadow at `light.target`, whose world matrix it follows only once
   * the target stands in the scene. The editor adds it in `buildLight`; a game that did not would
   * throw every shadow at the world origin, with nothing to say so.
   */
  it('stands the target its sun aims at in the scene, as the editor does', async () => {
    const built = await buildGameScene(sceneOf([lightNode(SUN, { x: 0, y: 4, z: 0 })]), NOTHING)

    const light = [...built.byEntity.values()].find(one => one instanceof DirectionalLight)
    expect(light && built.scene.children.includes(light.target)).toBe(true)
  })

  it('leaves alone what the document says throws nothing', async () => {
    const node = { ...meshNode(BOX, { name: 'Crate' }), castShadow: false, receiveShadow: false }
    const built = await buildGameScene(sceneOf([node]), NOTHING)

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
    const built = await buildGameScene(sceneOf([child, parent]), NOTHING)

    expect(built.byEntity.get(child.id)?.castShadow).toBe(false)
  })
})

/** What decides a depth pass in an exported frame — see `createWebRender`, which reads it. */
describe('what a settled frame answers', () => {
  it('owes nothing for a head that drives no clip, however far the clock has run', async () => {
    const built = await buildGameScene(sceneOf([meshNode(BOX, { name: 'Crate' })]), NOTHING)

    expect(built.seek(4 * SECOND)).toBe(false)
    built.dispose()
  })

  it('owes nothing once the scene it settled has stopped changing', async () => {
    const built = await buildGameScene(
      sceneOf([meshNode(BOX, { name: 'Crate' }), lightNode(SUN, { x: 0, y: 4, z: 0 })]),
      NOTHING,
    )
    const camera = new PerspectiveCamera()

    built.flush(camera)

    expect(built.flush(camera)).toBe(false)
    built.dispose()
  })
})

/**
 * 🛑 A reach of zero writes `left = right = top = bottom = 0`, and three's orthographic projection
 * then divides by that width: the matrix carries Infinity and the sun rasterises NOTHING. The
 * editor cannot reach it — it floors on its grid — so the game floors on the same number.
 */
describe('how far an exported game frames its sun', () => {
  it('falls back on the editor floor when the scene frames nothing, keeping the matrix finite', () => {
    const sun = new DirectionalLight()
    sun.castShadow = true

    fitShadowCamera(sun, gameShadowReach(new Box3()))

    expect(gameShadowReach(new Box3())).toBeGreaterThan(0)
    expect(sun.shadow.camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true)
  })

  it('frames what the scene occupies once it holds something', () => {
    const wide = new Box3(new Vector3(-50, 0, -50), new Vector3(50, 4, 50))

    expect(gameShadowReach(wide)).toBeGreaterThan(gameShadowReach(new Box3()))
  })
})
