import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { installFakeBridge } from '@/services/fakeBridge'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { runAction } from './executor'

const DOCUMENT = 'doc-post'

const scene = () => sceneOf(useScenes.getState(), DOCUMENT)

async function cameraNamed(name: string): Promise<string> {
  const added = await runAction('node.add', { kind: 'camera', name })
  return added.ok ? (added.data as { nodeId: string }).nodeId : ''
}

beforeEach(() => {
  installScene(DOCUMENT, { ...createDefaultScene(), nodes: [], selectedIds: [] })
  installFakeBridge({})
})

/**
 * A camera says one of three things about the scene's composition: it inherits it, it overrides
 * it with one of its own, or it films through NONE. The first two own a stack the call can be
 * pointed at; the third owns nothing, and answering the scene's would rewrite what every other
 * camera shows while leaving the named one untouched — silently, and reported as done.
 */
describe('a camera that composes through nothing', () => {
  const disabled = async (name: string): Promise<string> => {
    const nodeId = await cameraNamed(name)
    await runAction('post.camera', { nodeId, mode: 'disabled' })
    return nodeId
  }

  it('refuses an edit rather than sending it to the scene', async () => {
    const nodeId = await disabled('Caméra muette')
    await runAction('post.add', { effect: 'bloom' })
    const before = scene().world.post.effects.length

    const outcome = await runAction('post.add', { cameraId: nodeId, effect: 'vignette' })

    expect(outcome.ok).toBe(false)
    expect(scene().world.post.effects).toHaveLength(before)
  })

  // A READ is answered rather than refused, and with the truth: no effects, because none run.
  it('reads back an empty composition of its own', async () => {
    const nodeId = await disabled('Caméra muette')
    await runAction('post.add', { effect: 'bloom' })

    const outcome = await runAction('post.state', { cameraId: nodeId })
    const read = outcome.ok ? (outcome.data as { owner: string; effects: unknown[] }) : null

    expect(read).toMatchObject({ owner: 'camera', enabled: false, effects: [] })
  })

  // The case that must NOT change: inheriting is asking the scene, and that is the whole point.
  it('still sends an inheriting camera to the scene', async () => {
    const nodeId = await cameraNamed('Caméra héritière')

    const outcome = await runAction('post.add', { cameraId: nodeId, effect: 'vignette' })

    expect(outcome.ok).toBe(true)
    expect(scene().world.post.effects.map(one => one.effect)).toEqual(['vignette'])
  })
})
