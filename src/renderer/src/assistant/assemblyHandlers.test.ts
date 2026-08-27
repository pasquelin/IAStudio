import { beforeEach, describe, expect, it } from 'vitest'
import { barrelDocument, barrelNodes } from '@/engines/scene/prefab-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, sceneStore, useScenes } from '@/stores/scenes'
import { runAction } from './executor'

const DOCUMENT = 'doc-1'
const PREFAB = 'doc-barrel'
const scene = () => sceneOf(useScenes.getState(), DOCUMENT)

describe('a game put together in one gesture', () => {
  beforeEach(() => {
    installScene(DOCUMENT)
    useDocuments.setState({
      stored: [
        {
          id: PREFAB,
          kind: 'scene',
          workspace: '3d',
          title: 'Barrel',
          path: 'documents/Barrel.gltf',
        },
      ],
    })
    installFakeBridge({
      documents: { read: id => Promise.resolve(id === PREFAB ? barrelDocument(PREFAB) : null) },
    })
  })

  it('lays a template down into the scene in front', async () => {
    const outcome = await runAction('game.template', { template: 'thirdPerson' })

    expect(outcome).toMatchObject({ ok: true, data: { template: 'thirdPerson' } })
    expect(scene().nodes.map(node => node.name)).toContain('Character')
    expect(scene().world.play.camera).toBe('thirdPerson')
  })

  /** The choice field is what refuses it, and it names the three — so the caller can repair. */
  it('refuses a template the studio does not carry, listing the ones it has', async () => {
    const outcome = await runAction('game.template', { template: 'metroidvania' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(outcome.ok ? '' : outcome.detail).toContain('thirdPerson')
  })

  /** What a spoken request carries is a TITLE; a second call carries the id back. */
  it('instances a prefab named by its title, and one named by its id', async () => {
    expect(await runAction('prefab.instantiate', { prefab: 'Barrel' })).toMatchObject({
      ok: true,
      data: { nodes: 2 },
    })
    expect(await runAction('prefab.instantiate', { prefab: PREFAB })).toMatchObject({ ok: true })
    expect(scene().nodes.filter(node => node.name === 'Barrel')).toHaveLength(2)
  })

  it('puts it where it was asked for, and keeps what hangs off it', async () => {
    await runAction('prefab.instantiate', { prefab: 'Barrel', positionX: 3, positionZ: -2 })

    const root = scene().nodes.find(node => node.name === 'Barrel')
    expect(root?.transform.position).toMatchObject({ x: 3, z: -2 })
    expect(scene().nodes.find(node => node.parentId === root?.id)).toBeDefined()
  })

  /** The tab is where edits land: the disk would bring back a piece just deleted. */
  it('instances the OPEN tab of a prefab rather than its last save', async () => {
    // `replace` rather than a second `installScene`, which resets the whole map — the scene in
    // front would go, and the read would fall back to the disk it is meant to beat.
    sceneStore.use.getState().replace(PREFAB, { ...EMPTY_SCENE, nodes: barrelNodes().slice(0, 1) })

    expect(await runAction('prefab.instantiate', { prefab: PREFAB })).toMatchObject({
      ok: true,
      data: { nodes: 1 },
    })
  })

  /** Instancing the scene in front into itself doubles it, from its stale copy, for ever. */
  it('refuses to instance the scene in front into itself', async () => {
    expect(await runAction('prefab.instantiate', { prefab: DOCUMENT })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('refuses a prefab the project does not hold', async () => {
    expect(await runAction('prefab.instantiate', { prefab: 'Anvil' })).toMatchObject({
      ok: false,
      refusal: 'notFound',
    })
  })

  /** Both gestures write into the open scene, and there is none until one is in front. */
  it('refuses both when no scene is in front', async () => {
    useDocuments.setState({ documents: {}, stored: [], activeId: null })

    expect(await runAction('game.template', { template: 'thirdPerson' })).toMatchObject({
      ok: false,
      refusal: 'wrongSurface',
    })
    expect(await runAction('prefab.instantiate', { prefab: 'Barrel' })).toMatchObject({
      ok: false,
      refusal: 'wrongSurface',
    })
  })
})
