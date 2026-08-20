import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assistantAction, type ActionName } from '@shared/domain/assistant'
import type { SceneWorld } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { displayOfPane, sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useDocuments } from '@/stores/documents'
import { runAction } from './executor'

const DOCUMENT = 'doc-scene'

function scene(): SceneState {
  return sceneOf(useScenes.getState(), DOCUMENT)
}

const nodeNamed = (name: string): SceneNode | undefined =>
  scene().nodes.find(node => node.name === name)

async function cameraId(): Promise<string> {
  const added = await runAction('node.add', { kind: 'camera', name: 'Caméra' })
  return added.ok ? (added.data as { nodeId: string }).nodeId : ''
}

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

  it('holds a frame of length for a duration asked for below one', async () => {
    await runAction('camera.shot', { nodeId: await cameraId(), durationSeconds: 0 })

    expect(scene().animation.shots[0]?.duration).toBeGreaterThan(0)
  })

  /** The id is the whole of what makes the two edits below reachable at all. */
  it('answers the id of the shot it opened, and edits it by that id', async () => {
    const opened = await runAction('camera.shot', { nodeId: await cameraId(), startSeconds: 1 })
    const shotId = opened.ok ? (opened.data as { shotId: string }).shotId : ''

    expect(scene().animation.shots[0]?.id).toBe(shotId)
  })
})

describe('what a shot does with its camera', () => {
  async function shotOnRail(): Promise<{ shotId: string; pathId: string }> {
    const opened = await runAction('camera.shot', { nodeId: await cameraId() })
    const rail = await runAction('node.add', { kind: 'path', name: 'Rail' })

    return {
      shotId: opened.ok ? (opened.data as { shotId: string }).shotId : '',
      pathId: rail.ok ? (rail.data as { nodeId: string }).nodeId : '',
    }
  }

  it('binds a rail to a shot, taking the whole of it forwards by default', async () => {
    const { shotId, pathId } = await shotOnRail()

    expect(await runAction('camera.rail', { shotId, pathId })).toEqual({ ok: true })
    expect(scene().animation.shots[0]?.motion).toEqual({
      pathId,
      from: 0,
      to: 1,
      easing: 'linear',
    })
  })

  it('takes the stretch and the speed curve it was given', async () => {
    const { shotId, pathId } = await shotOnRail()

    await runAction('camera.rail', { shotId, pathId, from: 1, to: 0.25, easing: 'easeInOut' })

    // `from` past `to` is left alone rather than reordered: that is what runs a rail backwards.
    expect(scene().animation.shots[0]?.motion).toMatchObject({
      from: 1,
      to: 0.25,
      easing: 'easeInOut',
    })
  })

  it('lets a shot go of its rail, leaving the camera where its own transform puts it', async () => {
    const { shotId, pathId } = await shotOnRail()
    await runAction('camera.rail', { shotId, pathId })

    await runAction('camera.rail', { shotId, pathId: '' })

    expect(scene().animation.shots[0]?.motion).toBeUndefined()
  })

  it('refuses a rail that is not a path, rather than binding an id nothing answers to', async () => {
    const { shotId } = await shotOnRail()
    const mesh = await runAction('node.add', { kind: 'box', name: 'Caisse' })

    expect(
      await runAction('camera.rail', {
        shotId,
        pathId: mesh.ok ? (mesh.data as { nodeId: string }).nodeId : '',
      }),
    ).toEqual({ ok: false, refusal: 'badInput' })
    expect(scene().animation.shots[0]?.motion).toBeUndefined()
  })

  it('aims a shot at a node, at a point, and at nothing at all', async () => {
    const { shotId } = await shotOnRail()
    const mesh = await runAction('node.add', { kind: 'box', name: 'Statue' })
    const nodeId = mesh.ok ? (mesh.data as { nodeId: string }).nodeId : ''

    await runAction('camera.target', { shotId, targetId: nodeId })
    expect(scene().animation.shots[0]?.target).toEqual({ kind: 'node', nodeId })

    await runAction('camera.target', { shotId, atX: 1, atZ: -3 })
    expect(scene().animation.shots[0]?.target).toEqual({
      kind: 'point',
      at: { x: 1, y: 0, z: -3 },
    })

    await runAction('camera.target', { shotId })
    expect(scene().animation.shots[0]?.target).toBeUndefined()
  })

  // `aimCamera` drops a camera watching itself, since `lookAt` on no direction hands back the
  // identity — a shot silently aimed down the Z axis.
  it('refuses to have a camera watch itself, or a node the scene has not got', async () => {
    const opened = await runAction('camera.shot', { nodeId: await cameraId() })
    const shotId = opened.ok ? (opened.data as { shotId: string }).shotId : ''

    expect(
      await runAction('camera.target', { shotId, targetId: scene().animation.shots[0]?.cameraId }),
    ).toEqual({ ok: false, refusal: 'badInput' })
    expect(await runAction('camera.target', { shotId, targetId: 'nowhere' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('refuses an edit naming a shot the document has not got', async () => {
    expect(await runAction('camera.rail', { shotId: 'nowhere', pathId: '' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  // Without them a client can open a shot and never edit one: the two actions above name it by
  // an id only this reading hands over.
  it('publishes the shots, the lens of a camera and the points of a rail', async () => {
    const { pathId } = await shotOnRail()

    const outcome = await runAction('scene.state', {})
    const read = outcome.ok
      ? (outcome.data as {
          shots: { id: string }[]
          nodes: { id: string; camera?: unknown; path?: unknown }[]
        })
      : null

    expect(read?.shots).toHaveLength(1)
    expect(read?.nodes.find(node => node.id === pathId)?.path).toMatchObject({
      kind: 'catmullrom',
    })
    expect(read?.nodes.some(node => node.camera !== undefined)).toBe(true)
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

/**
 * The two the native menu offers by name and no command can — `scene.display` cycles, and
 * cycling to a chosen mode means counting the ones in between.
 */
describe('how the scene is looked at', () => {
  it('points the main view at a side, through the engine that owns the camera', async () => {
    const viewFrom = vi.fn()
    registerSceneEngine(DOCUMENT, { viewFrom } as unknown as SceneRenderer)

    expect(await runAction('view.direction', { direction: 'top' })).toEqual({ ok: true })
    expect(viewFrom).toHaveBeenCalledWith('top')

    forgetSceneEngine(DOCUMENT)
  })

  // A tab whose viewport is not mounted has no engine, and a side to look from is a move only
  // the engine can make.
  it('refuses a side while no viewport is mounted', async () => {
    forgetSceneEngine(DOCUMENT)

    expect(await runAction('view.direction', { direction: 'top' })).toEqual({
      ok: false,
      refusal: 'wrongSurface',
    })
  })

  it('names the way the main view is drawn, where the command only cycles', async () => {
    expect(await runAction('view.display', { mode: 'wireframe' })).toEqual({ ok: true })
    expect(displayOfPane(sceneViewOf(useSceneViews.getState(), DOCUMENT).displays, 0)).toBe(
      'wireframe',
    )
  })
})

/** The half of the document that belongs to no node — lit, backed, floored and graded. */
describe('the world of the scene', () => {
  it('reads back every part of it, and not the environment alone', async () => {
    await runAction('world.fog', { kind: 'exp2', density: 0.05 })
    await runAction('world.render', { toneMapping: 'aces', exposure: 1.4 })

    const outcome = await runAction('scene.state', {})
    const read = outcome.ok ? (outcome.data as { world: SceneWorld }).world : null

    expect(read?.fog).toEqual({ kind: 'exp2', color: expect.any(String), density: 0.05 })
    expect(read?.toneMapping).toBe('aces')
    expect(read?.exposure).toBe(1.4)
    expect(read?.ground).toEqual(scene().world.ground)
  })

  it('lights the scene by a named sky, and puts it back out', async () => {
    expect(await runAction('world.environment', { assetId: 'sky-1', intensity: 1.5 })).toEqual({
      ok: true,
    })
    expect(scene().world.environment).toEqual({ kind: 'skybox', assetId: 'sky-1' })
    expect(scene().world.envIntensity).toBe(1.5)

    await runAction('world.environment', { kind: 'studio' })

    expect(scene().world.environment).toEqual({ kind: 'studio' })
  })

  /**
   * The panel answers this one by taking the first sky of the project. From outside that would be
   * a reference nobody picked, so the call is refused rather than guessed at.
   */
  it('refuses a sky nobody named', async () => {
    expect(await runAction('world.environment', { kind: 'skybox' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * `transparent` is the shape a client most wants and no other call offers: a capture with
   * nothing behind the subject. The colour is written by the same call rather than by a second.
   */
  it('paints the backdrop, and takes it away entirely', async () => {
    await runAction('world.background', { kind: 'color', color: '#123456' })

    expect(scene().world.background).toEqual({ kind: 'color', color: '#123456' })

    await runAction('world.background', { kind: 'transparent' })

    expect(scene().world.background).toEqual({ kind: 'transparent' })
  })

  it('takes the distances of a linear haze, and forgets them when it is turned off', async () => {
    await runAction('world.fog', { kind: 'linear', color: '#334455', near: 5, far: 90 })

    expect(scene().world.fog).toEqual({ kind: 'linear', color: '#334455', near: 5, far: 90 })

    await runAction('world.fog', { kind: 'none' })

    expect(scene().world.fog).toEqual({ kind: 'none' })
  })

  /** The trap of an optional boolean: read as `false`, a call about the size would hide the floor. */
  it('leaves the ground showing when only its size is named', async () => {
    await runAction('world.ground', { visible: true })
    await runAction('world.ground', { size: 60 })

    expect(scene().world.ground).toMatchObject({ visible: true, size: 60 })
  })

  it('refuses a call that names nothing at all', async () => {
    expect(await runAction('world.ground', {})).toEqual({ ok: false, refusal: 'badInput' })
    expect(await runAction('world.render', {})).toEqual({ ok: false, refusal: 'badInput' })
    expect(await runAction('world.environment', {})).toEqual({ ok: false, refusal: 'badInput' })
  })

  /**
   * `no-unreachable-command` holds `setWorld` as PUBLISHED, which it now is — and a patch command
   * says nothing about its fields. This is what names the members no action writes, so a member
   * added to the world does not gain a door by accident.
   */
  it('names the members of the world nothing can write', async () => {
    const world: readonly ActionName[] = [
      'world.environment',
      'world.background',
      'world.fog',
      'world.ground',
      'world.render',
    ]
    const written = new Set(
      world.flatMap(name => assistantAction(name)?.fields ?? []).map(field => field.key),
    )

    const reached: Record<keyof SceneWorld, boolean> = {
      environment: written.has('kind'),
      envIntensity: written.has('intensity'),
      envRotation: written.has('rotation'),
      background: written.has('blur'),
      fog: written.has('density'),
      toneMapping: written.has('toneMapping'),
      exposure: written.has('exposure'),
      ground: written.has('receiveShadow'),
      // How a set is WALKED. Nothing reads it yet either — see `ScenePlay`, whose own note says
      // it is written by templates and by nothing else.
      play: false,
    }

    expect(
      Object.entries(reached)
        .filter(([, held]) => !held)
        .map(([member]) => member),
    ).toEqual(['play'])
  })
})
