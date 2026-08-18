import { beforeEach, describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useDocuments } from '@/stores/documents'
import { runAction } from './executor'

const DOCUMENT = 'doc-scene'

function scene(): SceneState {
  return sceneOf(useScenes.getState(), DOCUMENT)
}

const nodeNamed = (name: string): SceneNode | undefined =>
  scene().nodes.find(node => node.name === name)

beforeEach(() => {
  installScene(DOCUMENT, { ...createDefaultScene(), nodes: [], selectedIds: [] })
})

describe('reading the scene in front', () => {
  it('answers the flat list of nodes, with what each one carries', async () => {
    await runAction('node.add', { kind: 'box', name: 'Caisse' })

    const outcome = await runAction('scene.state', {})
    const read = outcome.ok
      ? (outcome.data as { nodes: { name: string; geometry?: unknown }[] })
      : null

    expect(read?.nodes).toHaveLength(1)
    expect(read?.nodes[0]).toMatchObject({ name: 'Caisse', type: 'mesh' })
    expect(read?.nodes[0]?.geometry).toMatchObject({ kind: 'box' })
  })

  it('refuses every action of the family while no scene is in front', async () => {
    useDocuments.setState({ documents: {}, activeId: null })

    expect(await runAction('scene.state', {})).toEqual({ ok: false, refusal: 'wrongSurface' })
    expect(await runAction('node.add', { kind: 'box' })).toEqual({
      ok: false,
      refusal: 'wrongSurface',
    })
  })
})

describe('building a scene', () => {
  /**
   * Through `createNodeOf`, the factory the Add menu and the native menu already go through: a
   * second way of building a box would be a second set of defaults to keep in step.
   */
  it('adds any kind the Add menu offers, at the position given', async () => {
    const outcome = await runAction('node.add', {
      kind: 'sphere',
      name: 'Boule',
      positionX: 2,
      positionZ: -1,
    })
    const added = outcome.ok ? (outcome.data as { nodeId: string }) : null

    expect(added?.nodeId).toBeTruthy()
    expect(nodeNamed('Boule')?.transform.position).toMatchObject({ x: 2, y: 0, z: -1 })
  })

  it('adds a light, and a model of the library', async () => {
    await runAction('node.add', { kind: 'directional', name: 'Clé' })
    await runAction('node.addModel', { assetId: 'asset-mesh', name: 'Chevalier' })

    expect(nodeNamed('Clé')?.type).toBe('light')
    expect(nodeNamed('Chevalier')).toMatchObject({
      type: 'model',
      model: { assetId: 'asset-mesh' },
    })
  })

  // The factory answers `null` for a kind no registry declares, so this is where it becomes a
  // refusal rather than a node that silently never arrived.
  it('refuses a kind no registry declares', async () => {
    expect(await runAction('node.add', { kind: 'dodecahedron' })).toMatchObject({ ok: true })
    expect(await runAction('node.add', { kind: 'teapot' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('renames, hides and removes by id', async () => {
    const added = await runAction('node.add', { kind: 'box', name: 'Caisse' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    await runAction('node.rename', { nodeId, name: 'Socle' })
    expect(nodeNamed('Socle')).toBeTruthy()

    await runAction('node.visible', { nodeId, visible: false })
    expect(nodeNamed('Socle')?.visible).toBe(false)

    await runAction('node.remove', { nodeId })
    expect(scene().nodes).toHaveLength(0)
  })

  it('refuses an id the scene does not hold rather than reporting a no-op as done', async () => {
    expect(await runAction('node.rename', { nodeId: 'node-z', name: 'Rien' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })
})

describe('placing and dressing an object', () => {
  it('keeps every axis it was not given', async () => {
    const added = await runAction('node.add', { kind: 'box', name: 'Caisse', positionY: 3 })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    await runAction('node.transform', { nodeId, positionX: 1, scaleZ: 2 })

    expect(nodeNamed('Caisse')?.transform).toMatchObject({
      position: { x: 1, y: 3, z: 0 },
      scale: { x: 1, y: 1, z: 2 },
    })
  })

  it('paints a mesh, and refuses a node that carries no mesh material', async () => {
    const mesh = await runAction('node.add', { kind: 'box', name: 'Caisse' })
    const meshId = mesh.ok ? (mesh.data as { nodeId: string }).nodeId : ''
    const lamp = await runAction('node.add', { kind: 'point', name: 'Lampe' })
    const lampId = lamp.ok ? (lamp.data as { nodeId: string }).nodeId : ''

    await runAction('node.material', { nodeId: meshId, color: '#ff8800', roughness: 0.2 })
    expect(nodeNamed('Caisse')).toMatchObject({ material: { color: '#ff8800', roughness: 0.2 } })

    expect(await runAction('node.material', { nodeId: lampId, color: '#ffffff' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('sets a light’s colour and intensity, and refuses a mesh', async () => {
    const lamp = await runAction('node.add', { kind: 'point', name: 'Lampe' })
    const lampId = lamp.ok ? (lamp.data as { nodeId: string }).nodeId : ''
    const mesh = await runAction('node.add', { kind: 'box', name: 'Caisse' })
    const meshId = mesh.ok ? (mesh.data as { nodeId: string }).nodeId : ''

    await runAction('node.light', { nodeId: lampId, color: '#ffeedd', intensity: 4 })
    expect(nodeNamed('Lampe')).toMatchObject({ light: { color: '#ffeedd', intensity: 4 } })

    expect(await runAction('node.light', { nodeId: meshId, intensity: 2 })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * A hemisphere light has no `color` at all — it carries a sky colour and a ground colour — so
   * writing one would add a field its kind does not have.
   */
  it('leaves a hemisphere light’s two colours alone while taking its intensity', async () => {
    const added = await runAction('node.add', { kind: 'hemisphere', name: 'Ciel' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    await runAction('node.light', { nodeId, color: '#ff0000', intensity: 3 })

    const light = nodeNamed('Ciel')
    expect(light).toMatchObject({ light: { kind: 'hemisphere', intensity: 3 } })
    expect(light?.type === 'light' && 'color' in light.light).toBe(false)
  })
})

describe('a camera driven by value', () => {
  it('writes the lens fields it was given and keeps the rest, and refuses a mesh', async () => {
    const added = await runAction('node.add', { kind: 'camera', name: 'Caméra' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''
    const mesh = await runAction('node.add', { kind: 'box', name: 'Caisse' })
    const meshId = mesh.ok ? (mesh.data as { nodeId: string }).nodeId : ''

    await runAction('node.camera', { nodeId, fov: 24 })

    expect(nodeNamed('Caméra')).toMatchObject({ camera: { fov: 24, near: 0.1, far: 1000 } })
    expect(await runAction('node.camera', { nodeId: meshId, fov: 24 })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  // Seconds across the boundary, microseconds in the timeline: the conversion is the point.
  it('opens a shot at the second it was given', async () => {
    const added = await runAction('node.add', { kind: 'camera', name: 'Caméra' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    await runAction('camera.shot', { nodeId, startSeconds: 2 })

    expect(scene().animation.shots).toHaveLength(1)
    expect(scene().animation.shots[0]).toMatchObject({ cameraId: nodeId, start: 2 * SECOND })
  })

  it('refuses to open a shot for anything but a camera', async () => {
    const mesh = await runAction('node.add', { kind: 'box', name: 'Caisse' })
    const nodeId = mesh.ok ? (mesh.data as { nodeId: string }).nodeId : ''

    expect(await runAction('camera.shot', { nodeId })).toEqual({ ok: false, refusal: 'badInput' })
    expect(scene().animation.shots).toEqual([])
  })
})

describe('hierarchy and selection', () => {
  it('hangs a node under another, and back under the scene', async () => {
    const parent = await runAction('node.add', { kind: 'box', name: 'Parent' })
    const parentId = parent.ok ? (parent.data as { nodeId: string }).nodeId : ''
    const child = await runAction('node.add', { kind: 'sphere', name: 'Enfant' })
    const childId = child.ok ? (child.data as { nodeId: string }).nodeId : ''

    await runAction('node.reparent', { nodeId: childId, parentId })
    expect(nodeNamed('Enfant')?.parentId).toBe(parentId)

    await runAction('node.reparent', { nodeId: childId })
    expect(nodeNamed('Enfant')?.parentId).toBeNull()
  })

  it('refuses a parent the scene does not hold', async () => {
    const child = await runAction('node.add', { kind: 'sphere', name: 'Enfant' })
    const nodeId = child.ok ? (child.data as { nodeId: string }).nodeId : ''

    expect(await runAction('node.reparent', { nodeId, parentId: 'node-z' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })

  /**
   * `reparentNode` refuses a move that would close the tree on itself by handing the state back
   * untouched — which reads as done to anyone who only checked that the parent exists.
   */
  it('refuses to hang a node under itself or under its own child', async () => {
    const parent = await runAction('node.add', { kind: 'box', name: 'Parent' })
    const parentId = parent.ok ? (parent.data as { nodeId: string }).nodeId : ''
    const child = await runAction('node.add', { kind: 'sphere', name: 'Enfant' })
    const childId = child.ok ? (child.data as { nodeId: string }).nodeId : ''
    await runAction('node.reparent', { nodeId: childId, parentId })

    expect(await runAction('node.reparent', { nodeId: parentId, parentId })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(await runAction('node.reparent', { nodeId: parentId, parentId: childId })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(nodeNamed('Parent')?.parentId).toBeNull()
  })

  it('selects nodes, and refuses a list holding one the scene lost', async () => {
    const added = await runAction('node.add', { kind: 'box', name: 'Caisse' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    expect(await runAction('node.select', { nodeIds: [nodeId] })).toEqual({ ok: true })
    expect(scene().selectedIds).toEqual([nodeId])

    expect(await runAction('node.select', { nodeIds: [nodeId, 'node-z'] })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })
})
