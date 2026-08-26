import { beforeEach, describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { nodeById } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { runAction } from './executor'

const DOCUMENT = 'doc-scene'

const components = () => nodeById(sceneOf(useScenes.getState(), DOCUMENT), 'a')?.components

beforeEach(() => {
  installScene(DOCUMENT, {
    ...createDefaultScene(),
    nodes: [{ ...meshNode('a'), name: 'Cube Test' }],
    selectedIds: [],
  })
})

describe('what an object does while the game runs, driven from outside', () => {
  it('attaches a component at its defaults, aimed by name', async () => {
    expect(await runAction('component.attach', { nodeId: 'Cube Test', type: 'Health' })).toEqual({
      ok: true,
    })
    expect(components()).toEqual([newComponent('Health')])
  })

  /** Told apart from a call that did nothing: `ok` on a refusal sent a client re-sending it. */
  it('says so rather than reporting success when the object already carries one', async () => {
    await runAction('component.attach', { nodeId: 'Cube Test', type: 'Health' })

    expect(
      await runAction('component.attach', { nodeId: 'Cube Test', type: 'Health' }),
    ).toMatchObject({ ok: false })
  })

  it('tells a missing object from a component type it does not know', async () => {
    expect(
      await runAction('component.attach', { nodeId: 'Nowhere', type: 'Health' }),
    ).toMatchObject({ ok: false, refusal: 'notFound' })
    expect(
      await runAction('component.attach', { nodeId: 'Cube Test', type: 'Wings' }),
    ).toMatchObject({ ok: false })
  })

  /** A client cannot type a component's value, so it types a word and the registry reads it. */
  it('reads the word a client sent as the kind the descriptor declares', async () => {
    await runAction('component.attach', { nodeId: 'Cube Test', type: 'Health' })

    expect(
      await runAction('component.set', {
        nodeId: 'Cube Test',
        type: 'Health',
        field: 'max',
        value: '250',
      }),
    ).toEqual({ ok: true })
    expect(components()).toEqual([{ ...newComponent('Health'), max: 250 }])
  })

  it('refuses a field the component does not declare, and a word that is no number', async () => {
    await runAction('component.attach', { nodeId: 'Cube Test', type: 'Health' })

    const wrongField = { nodeId: 'Cube Test', type: 'Health', field: 'stamina', value: '3' }
    const wrongValue = { nodeId: 'Cube Test', type: 'Health', field: 'max', value: 'beaucoup' }

    expect(await runAction('component.set', wrongField)).toMatchObject({ ok: false })
    expect(await runAction('component.set', wrongValue)).toMatchObject({ ok: false })
    expect(components()).toEqual([newComponent('Health')])
  })

  it('detaches one, and refuses to detach one the object has not got', async () => {
    await runAction('component.attach', { nodeId: 'Cube Test', type: 'Health' })

    expect(await runAction('component.detach', { nodeId: 'Cube Test', type: 'Health' })).toEqual({
      ok: true,
    })
    expect(components()).toEqual([])
    expect(
      await runAction('component.detach', { nodeId: 'Cube Test', type: 'Health' }),
    ).toMatchObject({ ok: false })
  })
})
