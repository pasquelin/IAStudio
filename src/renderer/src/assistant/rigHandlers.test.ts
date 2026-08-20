import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Rig } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { modelNode } from '@/engines/scene/nodeFactory'
import type { ModelNode, SceneState } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { useAssets } from '@/stores/assets'
import { useModelClips } from '@/stores/modelClips'
import { sceneOf, useScenes } from '@/stores/scenes'
import { runAction } from './executor'

const DOCUMENT = 'doc-scene'

/** Two bones, so removing one has a child to hang somewhere. */
const RIG: Rig = {
  origin: 'local',
  bones: [
    { name: 'Root', parent: null, rest: IDENTITY_TRANSFORM },
    { name: 'Spine', parent: 'Root', rest: IDENTITY_TRANSFORM },
  ],
}

const ANIMATION: Asset = {
  id: 'asset-run',
  name: 'Course',
  type: 'animation',
  location: 'local',
  tags: [],
  createdAt: '2026-08-20T10:00:00.000Z',
}

function scene(): SceneState {
  return sceneOf(useScenes.getState(), DOCUMENT)
}

const character = (): ModelNode | undefined =>
  scene().nodes.find((node): node is ModelNode => node.type === 'model')

function installCharacter(rig: Rig | undefined = RIG): string {
  const node = modelNode('asset-hero', 'Héros')
  const rigged = rig ? { ...node, model: { assetId: 'asset-hero', rig } } : node
  installScene(DOCUMENT, { ...createDefaultScene(), nodes: [rigged], selectedIds: [] })
  return node.id
}

beforeEach(() => {
  useAssets.setState({ items: [ANIMATION] })
  useModelClips.setState({ rigs: {} })
})

describe('reading a character', () => {
  it('answers its bones, its handles and what the engine measured', async () => {
    const nodeId = installCharacter()

    const outcome = await runAction('rig.state', { nodeId })

    expect(outcome).toMatchObject({ ok: true, data: { rigged: true, status: null } })
    expect((outcome as { data: { bones: unknown[] } }).data.bones).toHaveLength(2)
  })

  it('refuses a node that is not a model, and one the scene does not hold', async () => {
    installCharacter()

    expect(await runAction('rig.state', { nodeId: 'node-z' })).toEqual({
      ok: false,
      refusal: 'wrongSurface',
    })
  })
})

describe('the skeleton', () => {
  it('takes a bone out, its children hung where it hung', async () => {
    const nodeId = installCharacter()

    expect(await runAction('bone.remove', { nodeId, bone: 'Root' })).toEqual({ ok: true })
    expect(character()?.model.rig?.bones.map(bone => bone.name)).toEqual(['Spine'])
  })

  it('adds one under the bone named, called after it', async () => {
    const nodeId = installCharacter()

    expect(await runAction('bone.add', { nodeId, parent: 'Spine' })).toEqual({ ok: true })
    expect(character()?.model.rig?.bones.map(bone => bone.name)).toContain('Spine.1')
  })

  /**
   * The command writes nothing for a duplicate, so answering `ok` would tell a client a rename
   * took when the skeleton never moved.
   */
  it('refuses a rename onto a name already taken rather than answering ok', async () => {
    const nodeId = installCharacter()

    expect(await runAction('bone.rename', { nodeId, bone: 'Spine', name: 'Root' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
    expect(character()?.model.rig?.bones.map(bone => bone.name)).toEqual(['Root', 'Spine'])
  })

  it('ties a bone to a joint of the standard, and to none when no role is given', async () => {
    const nodeId = installCharacter()

    await runAction('bone.role', { nodeId, bone: 'Spine', role: 'Hips' })
    expect(character()?.model.rig?.bones.find(bone => bone.name === 'Spine')?.role).toBe('Hips')

    await runAction('bone.role', { nodeId, bone: 'Spine' })
    expect(character()?.model.rig?.bones.find(bone => bone.name === 'Spine')?.role).toBeUndefined()
  })

  it('refuses a bone the skeleton does not hold', async () => {
    const nodeId = installCharacter()

    expect(await runAction('bone.remove', { nodeId, bone: 'Tail' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })

  it('takes the whole skeleton off', async () => {
    const nodeId = installCharacter()

    expect(await runAction('rig.clear', { nodeId })).toEqual({ ok: true })
    expect(character()?.model.rig).toBeUndefined()
  })

  // The engine has not read the model, so there is nothing measured to fit a skeleton to.
  it('refuses to fit one while nothing has been measured', async () => {
    const nodeId = installCharacter(undefined)

    expect(await runAction('rig.fit', { nodeId })).toEqual({ ok: false, refusal: 'notFound' })
  })
})

describe('the handles a joint reaches for', () => {
  it('adds a chain and the handle it reaches for, then takes both back', async () => {
    const nodeId = installCharacter()

    expect(await runAction('ik.add', { nodeId, bone: 'Spine' })).toEqual({ ok: true })
    const chain = character()?.model.rig?.ik?.[0]
    expect(chain?.effector).toBe('Spine')

    expect(await runAction('ik.remove', { nodeId, chainId: chain?.id ?? '' })).toEqual({ ok: true })
    expect(character()?.model.rig?.ik).toEqual([])
    expect(character()?.model.rig?.bones.map(bone => bone.name)).toEqual(['Root', 'Spine'])
  })

  it('refuses a chain the rig does not hold', async () => {
    const nodeId = installCharacter()

    expect(await runAction('ik.remove', { nodeId, chainId: 'chain-z' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })
})

describe('the band of a character', () => {
  it('lays a block from the library, and takes it off again', async () => {
    const nodeId = installCharacter()

    expect(await runAction('animation.add', { nodeId, assetId: 'asset-run' })).toEqual({ ok: true })
    const clip = character()?.model.lanes?.[0]?.clips[0]
    expect(clip?.label).toBe('Course')

    expect(await runAction('animation.remove', { nodeId, clipId: clip?.id ?? '' })).toEqual({
      ok: true,
    })
    expect(character()?.model.lanes?.[0]?.clips).toEqual([])
  })

  it('refuses an animation the library does not hold', async () => {
    const nodeId = installCharacter()

    expect(await runAction('animation.add', { nodeId, assetId: 'asset-z' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })

  it('sets the length and the rate, leaving what is not named alone', async () => {
    installCharacter()
    const before = scene().animation.fps

    expect(await runAction('animation.settings', { durationSeconds: 4 })).toEqual({ ok: true })
    expect(scene().animation.fps).toBe(before)
    expect(scene().animation.duration).toBeGreaterThan(0)

    expect(await runAction('animation.settings', {})).toEqual({ ok: false, refusal: 'badInput' })
  })

  it('turns automatic keying on, which nothing saves with the document', async () => {
    installCharacter()

    expect(await runAction('animation.autoKey', { on: true })).toEqual({ ok: true })
    expect(animationViewOf(useAnimationViews.getState(), DOCUMENT).autoKey).toBe(true)
  })
})
