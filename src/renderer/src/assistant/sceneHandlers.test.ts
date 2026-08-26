import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnimationTrack } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { assistantAction, type ActionName } from '@shared/domain/assistant'
import { TEXTURE_SLOTS, type SceneWorld } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { createNodeOf } from '@/engines/scene/nodeFactory'
import { installFakeBridge } from '@/services/fakeBridge'
import { GEOMETRY_SPECS, type PropertySpec } from '@/engines/scene/propertyFields'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { installDocuments } from '@/stores/document-fixtures'
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

/** What the catalogue holds for this suite: `node.addModel` and `world.environment` read it. */
const inCatalogue = (id: string, type: Asset['type']): Asset => ({
  id,
  name: id,
  type,
  location: 'local',
  tags: [],
  createdAt: '2026-08-20T10:00:00.000Z',
})

const CATALOGUE = [inCatalogue('asset-mesh', 'mesh'), inCatalogue('sky-1', 'skybox')]

beforeEach(() => {
  installScene(DOCUMENT, { ...createDefaultScene(), nodes: [], selectedIds: [] })
  installFakeBridge({
    assets: {
      search: query => Promise.resolve(CATALOGUE.filter(one => query.ids?.includes(one.id))),
    },
  })
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
    expect(await runAction('node.add', { kind: 'teapot' })).toMatchObject({
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

  /**
   * `notFound` and not `badInput`: a client re-sending a `node.remove` whose node it had just
   * removed read the same refusal as a malformed call — 33 of them on the bench pass of
   * 2026-08-26, none saying the object was already gone.
   */
  it('refuses an id the scene does not hold as missing, not as a bad input', async () => {
    expect(await runAction('node.rename', { nodeId: 'node-z', name: 'Rien' })).toMatchObject({
      ok: false,
      refusal: 'notFound',
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

    expect(await runAction('node.material', { nodeId: lampId, color: '#ffffff' })).toMatchObject({
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

    expect(await runAction('node.light', { nodeId: meshId, intensity: 2 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * A hemisphere light has no `color` at all — it carries a sky colour and a ground colour — so
   * naming one is refused rather than filed against a field the kind does not have.
   */
  it('takes a hemisphere light’s own two colours, and refuses the one it has not', async () => {
    const added = await runAction('node.add', { kind: 'hemisphere', name: 'Ciel' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    expect(await runAction('node.light', { nodeId, color: '#ff0000', intensity: 3 })).toMatchObject(
      {
        ok: false,
        refusal: 'badInput',
      },
    )

    await runAction('node.light', { nodeId, skyColor: '#ff0000', intensity: 3 })

    const light = nodeNamed('Ciel')
    expect(light).toMatchObject({
      light: { kind: 'hemisphere', intensity: 3, skyColor: '#ff0000' },
    })
    expect(light?.type === 'light' && 'color' in light.light).toBe(false)
  })

  /** A cone belongs to a spot, and its target is three numbers that land as one field. */
  it('writes the cone and the target of a spot, and refuses a cone on a point light', async () => {
    const spot = await runAction('node.add', { kind: 'spot', name: 'Poursuite' })
    const point = await runAction('node.add', { kind: 'point', name: 'Bougie' })
    const spotId = spot.ok ? (spot.data as { nodeId: string }).nodeId : ''
    const pointId = point.ok ? (point.data as { nodeId: string }).nodeId : ''

    await runAction('node.light', {
      nodeId: spotId,
      angle: 0.4,
      penumbra: 0.25,
      distance: 12,
      targetY: 2,
    })

    expect(nodeNamed('Poursuite')).toMatchObject({
      light: { kind: 'spot', angle: 0.4, penumbra: 0.25, distance: 12, target: { y: 2 } },
    })
    expect(await runAction('node.light', { nodeId: pointId, angle: 0.4 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
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
    expect(await runAction('node.camera', { nodeId: meshId, fov: 24 })).toMatchObject({
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

    expect(await runAction('camera.shot', { nodeId })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
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

  /** The inspector's own button: one gesture makes the rail AND binds it, so one ⌘Z takes both. */
  it('lays a rail where the camera stands and binds it in one entry', async () => {
    const opened = await runAction('camera.shot', { nodeId: await cameraId() })
    const shotId = opened.ok ? (opened.data as { shotId: string }).shotId : ''

    expect(await runAction('camera.addRail', { shotId })).toEqual({ ok: true })

    const laid = scene().nodes.find(node => node.type === 'path')
    expect(scene().animation.shots[0]?.motion).toMatchObject({ pathId: laid?.id })

    useScenes.getState().undo(DOCUMENT)
    expect(scene().nodes.some(node => node.type === 'path')).toBe(false)
    expect(scene().animation.shots[0]?.motion).toBeUndefined()
  })

  it('takes a camera’s line up the band, and refuses one that cannot move', async () => {
    const first = await cameraId()
    const second = await cameraId()
    await runAction('camera.shot', { nodeId: first })
    await runAction('camera.shot', { nodeId: second })

    // The stack decides what the film looks through, and a camera new to the band arrives on top:
    // the first one is at the bottom, so the only way it can go is up.
    expect(await runAction('camera.reorder', { nodeId: first, by: -1 })).toMatchObject({
      ok: true,
      data: { steps: -1 },
    })
    expect(scene().animation.shots[0]?.cameraId).toBe(first)
    expect(await runAction('camera.reorder', { nodeId: 'node-z', by: 1 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

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
    ).toMatchObject({ ok: false, refusal: 'badInput' })
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
    ).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(await runAction('camera.target', { shotId, targetId: 'nowhere' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('refuses an edit naming a shot the document has not got', async () => {
    expect(await runAction('camera.rail', { shotId: 'nowhere', pathId: '' })).toMatchObject({
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

    expect(await runAction('node.reparent', { nodeId: parentId, parentId })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(await runAction('node.reparent', { nodeId: parentId, parentId: childId })).toMatchObject(
      {
        ok: false,
        refusal: 'badInput',
      },
    )
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
describe('a still of the view, and a world in one call', () => {
  const CAPTURED: Asset = {
    id: 'asset-still',
    name: 'Scène',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-20T10:00:00.000Z',
  }

  it('writes what a preset is about and leaves the rest of the world alone', async () => {
    await runAction('world.ground', { visible: true, size: 12 })

    expect(await runAction('world.preset', { preset: 'night' })).toEqual({ ok: true })

    expect(scene().world).toMatchObject({ envIntensity: 0.15, exposure: 1.6 })
    // `night` says nothing about a ground, so the one turned on stays exactly as it was.
    expect(scene().world.ground).toMatchObject({ visible: true, size: 12 })
  })

  it('captures at the quality asked for, and refuses while no viewport is mounted', async () => {
    const captureStill = vi.fn(async () => new Uint8Array([1]))
    const savePicture = vi.fn(async () => CAPTURED)
    installFakeBridge({ assets: { savePicture } })
    registerSceneEngine(DOCUMENT, { captureStill } as unknown as SceneRenderer)

    expect(await runAction('scene.capture', { quality: 'ultraHd' })).toEqual({ ok: true })
    expect(captureStill).toHaveBeenCalledWith('ultraHd')
    expect(savePicture).toHaveBeenCalled()

    forgetSceneEngine(DOCUMENT)
    expect(await runAction('scene.capture', {})).toEqual({ ok: false, refusal: 'failed' })
  })
})

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
    expect(await runAction('world.environment', { kind: 'skybox' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * A scene FOLLOWS a sky document: it takes its graded picture, its sun and its intensity, and
   * editing that sky edits the scene. Named by TITLE, since a document id is nothing anyone types.
   */
  it('follows a sky document named by its title', async () => {
    installDocuments({ 'sky-doc': 'skyboxes', [DOCUMENT]: '3d' }, DOCUMENT)

    expect(await runAction('world.environment', { sky: 'sky-doc' })).toEqual({ ok: true })
    expect(scene().world.environment).toEqual({ kind: 'sky', documentId: 'sky-doc' })
  })

  it('refuses a sky document the project does not hold', async () => {
    expect(await runAction('world.environment', { sky: 'Nulle part' })).toMatchObject({
      ok: false,
      refusal: 'notFound',
    })
  })

  // A scene is lit by ONE prefiltered map, so naming both is a request with two answers.
  it('refuses a picture and a sky document at once', async () => {
    expect(
      await runAction('world.environment', { assetId: 'sky-1', sky: 'sky-doc' }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  it('refuses a sky document nobody named', async () => {
    expect(await runAction('world.environment', { kind: 'sky' })).toMatchObject({
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

  /**
   * The switch the panel uses answers with the DEFAULTS of the shape it opens, so re-asserting
   * the shape in hand to change one value took the other two back to 10 and 60 in silence.
   */
  it('keeps the distances when only the colour of the same haze is named', async () => {
    await runAction('world.fog', { kind: 'linear', near: 5, far: 90 })
    await runAction('world.fog', { kind: 'linear', color: '#ff0000' })

    expect(scene().world.fog).toEqual({ kind: 'linear', color: '#ff0000', near: 5, far: 90 })
  })

  it('keeps the softening of a backdrop re-asserted as itself', async () => {
    await runAction('world.background', { kind: 'environment', blur: 0.5 })
    await runAction('world.background', { kind: 'environment' })

    expect(scene().world.background).toEqual({ kind: 'environment', blur: 0.5 })
  })

  /** A key a client believes took must never get a silent yes — the rule of `validatesInput`. */
  it('refuses a value that belongs to another shape, rather than dropping it', async () => {
    expect(await runAction('world.fog', { kind: 'exp2', near: 5 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(
      await runAction('world.background', { kind: 'transparent', color: '#000000' }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    // Both readings of this call contradict each other: putting the sky out, and naming one.
    expect(
      await runAction('world.environment', { kind: 'studio', assetId: 'sky-1' }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  /** The trap of an optional boolean: read as `false`, a call about the size would hide the floor. */
  it('leaves the ground showing when only its size is named', async () => {
    await runAction('world.ground', { visible: true })
    await runAction('world.ground', { size: 60 })

    expect(scene().world.ground).toMatchObject({ visible: true, size: 60 })
  })

  it('refuses a call that names nothing at all', async () => {
    expect(await runAction('world.ground', {})).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(await runAction('world.render', {})).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(await runAction('world.environment', {})).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
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

/**
 * The bounds a client is offered against the ones the inspector enforces. A schema that swings
 * wider than the field is a client told it may write what the panel cannot — and the registry
 * lives in `shared/`, which cannot import the tables, so the copy is held from this side.
 */
describe('what the registry offers a node', () => {
  const fieldOf = (name: ActionName, key: string) =>
    assistantAction(name)?.fields.find(field => field.key === key)

  /** Every spec that names a field, whatever the primitive holding it. */
  const specsByName = (): Map<string, PropertySpec[]> => {
    const held = new Map<string, PropertySpec[]>()

    for (const specs of Object.values(GEOMETRY_SPECS)) {
      for (const [name, spec] of Object.entries(specs)) {
        held.set(name, [...(held.get(name) ?? []), spec])
      }
    }

    return held
  }

  /** A bound only holds where EVERY kind carrying the name has one — otherwise it is open. */
  const across = (specs: readonly PropertySpec[], edge: 'min' | 'max'): number | undefined => {
    const bounds = specs.map(spec =>
      spec.control === 'color' || spec.control === 'vector3'
        ? undefined
        : (spec[edge] ?? undefined),
    )
    if (bounds.some(bound => bound === undefined)) return undefined

    return edge === 'min' ? Math.min(...bounds.map(Number)) : Math.max(...bounds.map(Number))
  }

  it('bounds every primitive parameter as the union of what the kinds declare', () => {
    for (const [name, specs] of specsByName()) {
      const field = fieldOf('node.geometry', name)

      expect({ min: field?.min, max: field?.max }, name).toEqual({
        min: across(specs, 'min'),
        max: across(specs, 'max'),
      })
    }
  })

  /** Counted, never measured: a segment and a half is a primitive three.js refuses to build. */
  it('publishes a whole number wherever the engine steps by one', () => {
    const counted = Object.values(GEOMETRY_SPECS).flatMap(specs =>
      Object.entries(specs)
        .filter(([, spec]) => spec.control !== 'color' && spec.step === 1)
        .map(([key]) => key),
    )

    expect(
      [...new Set(counted)].filter(key => fieldOf('node.geometry', key)?.kind !== 'integer'),
    ).toEqual([])
  })

  it('names every map slot the material holds, on the action that takes one', () => {
    expect([...(fieldOf('node.material', 'textures')?.options ?? [])].sort()).toEqual(
      [...TEXTURE_SLOTS].sort(),
    )
  })
})

describe('what a node is made of', () => {
  const meshNamed = async (kind: string, name: string): Promise<string> => {
    const added = await runAction('node.add', { kind, name })
    return added.ok ? (added.data as { nodeId: string }).nodeId : ''
  }

  it('writes the parameters of the primitive it was built from', async () => {
    const nodeId = await meshNamed('torusKnot', 'Nœud')

    await runAction('node.geometry', { nodeId, radius: 2, p: 3, q: 5 })

    expect(nodeNamed('Nœud')).toMatchObject({
      geometry: { kind: 'torusKnot', radius: 2, p: 3, q: 5, tube: 0.2 },
    })
  })

  it('refuses a parameter the shape has not got, rather than filing it', async () => {
    const nodeId = await meshNamed('box', 'Caisse')

    expect(await runAction('node.geometry', { nodeId, radius: 2 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(nodeNamed('Caisse')?.type === 'mesh' && 'radius' in nodeNamed('Caisse')!).toBe(false)
  })

  /**
   * The narrowing the registry cannot do: it publishes one segment as the floor because a torus
   * takes one, and a capsule's ring falls apart below three.
   */
  it('refuses a count the kind in hand puts out of range', async () => {
    const capsule = await meshNamed('capsule', 'Gélule')
    const torus = await meshNamed('torus', 'Anneau')

    expect(await runAction('node.geometry', { nodeId: capsule, radialSegments: 1 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(await runAction('node.geometry', { nodeId: torus, radialSegments: 1 })).toMatchObject({
      ok: true,
    })
  })

  it('throws and catches shadows, and refuses the half a light cannot hold', async () => {
    const mesh = await meshNamed('box', 'Caisse')
    const lamp = await meshNamed('point', 'Lampe')

    await runAction('node.shadow', { nodeId: mesh, castShadow: true, receiveShadow: true })
    await runAction('node.shadow', { nodeId: lamp, castShadow: true })

    expect(nodeNamed('Caisse')).toMatchObject({ castShadow: true, receiveShadow: true })
    expect(nodeNamed('Lampe')).toMatchObject({ castShadow: true })
    expect(await runAction('node.shadow', { nodeId: lamp, receiveShadow: true })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('dresses a mesh in the project’s own maps, and takes one back off', async () => {
    const nodeId = await meshNamed('plane', 'Mur')

    await runAction('node.material', {
      nodeId,
      tilesPerMetre: 2,
      textures: { map: 'asset-albedo', normalMap: 'asset-normal' },
    })
    expect(nodeNamed('Mur')).toMatchObject({
      material: { tilesPerMetre: 2, map: { assetId: 'asset-albedo' } },
    })

    await runAction('node.material', { nodeId, textures: { normalMap: '' } })
    expect(nodeNamed('Mur')).toMatchObject({
      material: { map: { assetId: 'asset-albedo' }, normalMap: null },
    })
  })

  it('paints a text with the very action a mesh takes, minus the tiling', async () => {
    const nodeId = await meshNamed('text', 'Titre')

    await runAction('node.material', { nodeId, color: '#00ff00' })
    expect(nodeNamed('Titre')).toMatchObject({ material: { color: '#00ff00' } })

    expect(await runAction('node.material', { nodeId, tilesPerMetre: 2 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('sets the words, the face and the shape of a text', async () => {
    const nodeId = await meshNamed('text', 'Titre')

    await runAction('node.text', {
      nodeId,
      value: 'Bonjour',
      fontFamily: 'IBM Plex Mono',
      textSize: 2,
      textDepth: 0,
    })

    expect(nodeNamed('Titre')).toMatchObject({
      text: { value: 'Bonjour', font: { family: 'IBM Plex Mono', source: 'embedded' }, size: 2 },
    })
  })

  it('tints and fades a sprite, and takes its picture away', async () => {
    const nodeId = await meshNamed('sprite', 'Panneau')

    await runAction('node.sprite', { nodeId, opacity: 0.5, map: 'asset-picture' })
    expect(nodeNamed('Panneau')).toMatchObject({
      sprite: { opacity: 0.5, map: { assetId: 'asset-picture' } },
    })

    await runAction('node.sprite', { nodeId, map: '' })
    expect(nodeNamed('Panneau')).toMatchObject({ sprite: { map: null } })
  })

  /**
   * A model NAMES a material and holds nothing of it, so taking one off is the whole gesture in
   * reverse: the node goes back to the maps its own `.glb` carries.
   */
  it('refuses a material the project does not hold, and takes one off on an empty name', async () => {
    const added = await runAction('node.addModel', { assetId: 'asset-mesh', name: 'Chevalier' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    const missing = await runAction('model.wearMaterial', { nodeId, material: 'Aucune matière' })
    expect(missing.ok).toBe(false)

    await runAction('model.wearMaterial', { nodeId, material: '' })

    const bare = nodeNamed('Chevalier')
    expect(bare).toMatchObject({ model: { assetId: 'asset-mesh' } })
    expect(bare?.type === 'model' && bare.model.materialDocumentId).toBeUndefined()
  })
})

describe('the shape of a rail', () => {
  const railId = async (): Promise<string> => {
    const added = await runAction('node.add', { kind: 'path', name: 'Rail' })
    return added.ok ? (added.data as { nodeId: string }).nodeId : ''
  }

  const points = () => {
    const node = nodeNamed('Rail')
    return node?.type === 'path' ? node.path.points : []
  }

  it('sets the tension and the closing, and refuses a call that names neither', async () => {
    const nodeId = await railId()

    await runAction('node.path', { nodeId, tension: 0, closed: true })
    expect(nodeNamed('Rail')).toMatchObject({ path: { tension: 0, closed: true } })

    expect(await runAction('node.path', { nodeId })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('lays a point where it was aimed, and slips one halfway after a named one', async () => {
    const nodeId = await railId()

    await runAction('path.addPoint', { nodeId, pointX: 4, pointY: 1, pointZ: -8 })
    expect(points().at(-1)).toEqual({ x: 4, y: 1, z: -8 })

    await runAction('path.addPoint', { nodeId, index: 0 })
    expect(points()[1]).toEqual({ x: 0, y: 0, z: -2.5 })
  })

  it('refuses a point that is both aimed at and placed by rank', async () => {
    const nodeId = await railId()

    expect(
      await runAction('path.addPoint', { nodeId, index: 0, pointX: 1, pointY: 0, pointZ: 0 }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(await runAction('path.addPoint', { nodeId, pointX: 1 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('moves a point, and refuses a rank naming none', async () => {
    const nodeId = await railId()

    await runAction('path.movePoint', { nodeId, index: 1, pointY: 3 })
    expect(points()[1]).toEqual({ x: 0, y: 3, z: -5 })

    expect(await runAction('path.movePoint', { nodeId, index: 7, pointY: 3 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  /** Two points is the floor: one point is not a line, and the refusal is what says so. */
  it('drops a point, and refuses to take a rail below two', async () => {
    const nodeId = await railId()

    await runAction('path.addPoint', { nodeId })
    expect(points()).toHaveLength(3)

    await runAction('path.removePoint', { nodeId, index: 2 })
    expect(points()).toHaveLength(2)

    expect(await runAction('path.removePoint', { nodeId, index: 1 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })
})

/**
 * The half of `node.transform` and `node.camera` that no other test reaches: tracks ADD to what
 * is underneath, so a value written raw onto a keyed node springs back the moment it is played.
 */
describe('a node an animation already drives', () => {
  const keyedTrack = (nodeId: string): AnimationTrack => ({
    id: 'track-position',
    name: 'Position',
    index: 0,
    muted: false,
    solo: false,
    locked: false,
    target: { nodeId, property: 'position' },
    rest: IDENTITY_TRANSFORM,
    keys: [],
  })

  function installKeyedBox(): string {
    const fresh = createDefaultScene()
    const box = createNodeOf('box')
    const nodeId = box?.id ?? ''

    installScene(DOCUMENT, {
      ...fresh,
      nodes: box ? [{ ...box, name: 'Caisse' }] : [],
      selectedIds: [],
      animation: { ...fresh.animation, tracks: [keyedTrack(nodeId)] },
    })

    return nodeId
  }

  it('writes a key rather than a move while auto-key records', async () => {
    const nodeId = installKeyedBox()
    await runAction('animation.autoKey', { on: true })

    await runAction('node.transform', { nodeId, positionY: 2 })

    expect(scene().animation.tracks[0]?.keys).toEqual([{ time: 0, value: { x: 0, y: 2, z: 0 } }])
    // Left where it rests: the channel adds the two metres back on top of it.
    expect(nodeNamed('Caisse')?.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('moves the node itself when nothing records', async () => {
    const nodeId = installKeyedBox()
    await runAction('animation.autoKey', { on: false })

    await runAction('node.transform', { nodeId, positionY: 2 })

    expect(scene().animation.tracks[0]?.keys).toEqual([])
    expect(nodeNamed('Caisse')?.transform.position).toMatchObject({ y: 2 })
  })

  /**
   * The fallback for an axis nobody named is the pose PLAYED, and this is what says so: taken from
   * the rest instead, the two metres the channel already holds would be keyed back to zero.
   */
  it('leaves the axes it was not given exactly where the channel plays them', async () => {
    const nodeId = installKeyedBox()
    await runAction('animation.autoKey', { on: true })
    await runAction('node.transform', { nodeId, positionY: 2 })

    await runAction('node.transform', { nodeId, positionX: 5 })

    expect(scene().animation.tracks[0]?.keys).toEqual([{ time: 0, value: { x: 5, y: 2, z: 0 } }])
  })

  /**
   * A lens whose channel plays reads the descriptor PLUS what the channel adds. Writing the value
   * asked for into the descriptor as well would move the rest under every other key of that
   * channel — the value at this instant would be right and every other one wrong.
   */
  it('keys a camera’s lens without moving the rest it is measured against', async () => {
    const fresh = createDefaultScene()
    const camera = createNodeOf('camera')
    const nodeId = camera?.id ?? ''
    const lens: AnimationTrack = {
      id: 'track-fov',
      name: 'Objectif',
      index: 0,
      muted: false,
      solo: false,
      locked: false,
      target: { nodeId, property: 'fov' },
      keys: [],
    }
    installScene(DOCUMENT, {
      ...fresh,
      nodes: camera ? [{ ...camera, name: 'Caméra' }] : [],
      selectedIds: [],
      animation: { ...fresh.animation, tracks: [lens] },
    })
    await runAction('animation.autoKey', { on: true })

    await runAction('node.camera', { nodeId, fov: 30, near: 0.5 })

    const written = nodeNamed('Caméra')
    expect(written?.type === 'camera' && written.camera).toMatchObject({ fov: 50, near: 0.5 })
    expect(scene().animation.tracks[0]?.keys).toEqual([{ time: 0, value: { x: -20, y: 0, z: 0 } }])
  })

  /** The floor `CAMERA_SPECS` holds, which the number field clamps and the registry cannot say. */
  it('refuses a near plane the inspector’s own field would not take', async () => {
    const added = await runAction('node.add', { kind: 'camera', name: 'Caméra' })
    const nodeId = added.ok ? (added.data as { nodeId: string }).nodeId : ''

    expect(await runAction('node.camera', { nodeId, near: 0 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })
})

/**
 * 🛑 What « d'un mètre vers le haut » becomes in one call. Without it a caller reads the pose,
 * does the arithmetic and writes the result — three chances to be wrong, and section 7 of the
 * bench scored 0 on five requests, every one written as an absolute.
 */
describe('a change given as a difference', () => {
  it('adds to a position and multiplies a scale', async () => {
    await runAction('node.add', { kind: 'box', name: 'Caisse', positionY: 2 })
    const id = nodeNamed('Caisse')?.id ?? ''

    await runAction('node.transform', { nodeId: id, positionY: 1, relative: true })
    expect(nodeNamed('Caisse')?.transform.position.y).toBe(3)

    await runAction('node.transform', { nodeId: id, scaleX: 0.5, relative: true })
    expect(nodeNamed('Caisse')?.transform.scale.x).toBe(0.5)
  })

  it('still writes a final value when nothing says otherwise', async () => {
    await runAction('node.add', { kind: 'box', name: 'Caisse', positionY: 2 })
    const id = nodeNamed('Caisse')?.id ?? ''

    await runAction('node.transform', { nodeId: id, positionY: 1 })
    expect(nodeNamed('Caisse')?.transform.position.y).toBe(1)
  })
})

/**
 * The two doors read ONE rule — `carvePlan` — and this is the half of it the window cannot show.
 * The scar this must not reopen: `canCarve` once filtered instead of refusing, and through this
 * very door that silently promoted the SECOND id to matter.
 */
describe('folding shapes through the outside door', () => {
  const shapes = async (): Promise<{ wall: string; cube: string }> => {
    await runAction('node.add', { kind: 'box', name: 'Mur' })
    await runAction('node.add', { kind: 'sphere', name: 'Cube' })
    // The wall is scaled up, so the election has a bigger and a smaller to tell apart.
    await runAction('node.transform', {
      nodeId: nodeNamed('Mur')?.id ?? '',
      scaleX: 4,
      scaleY: 3,
      scaleZ: 2,
    })
    return { wall: nodeNamed('Mur')?.id ?? '', cube: nodeNamed('Cube')?.id ?? '' }
  }

  const solid = (): SceneNode | undefined => scene().nodes.find(node => node.type === 'carved')

  it('elects the same matter whichever order the ids are named in', async () => {
    const { wall, cube } = await shapes()
    await runAction('node.carve', { nodeIds: [cube, wall], operation: 'subtract' })

    expect(solid()?.name).toBe('Mur')
  })

  it('lets a client name the matter outright', async () => {
    const { wall, cube } = await shapes()
    await runAction('node.carve', {
      nodeIds: [wall, cube],
      operation: 'subtract',
      matterId: cube,
    })

    expect(solid()?.name).toBe('Cube')
  })

  it('marks a shape as a tool, so joining it pierces instead', async () => {
    const { wall, cube } = await shapes()
    await runAction('node.negate', { nodeIds: [cube] })
    await runAction('node.carve', { nodeIds: [wall, cube], operation: 'unite' })

    const cut = solid()
    expect(cut?.type === 'carved' && cut.carved.steps[0]?.operation).toBe('subtract')
  })

  it('takes the mark off when asked', async () => {
    const { cube } = await shapes()
    await runAction('node.negate', { nodeIds: [cube] })
    await runAction('node.negate', { nodeIds: [cube], negative: false })

    const shape = nodeNamed('Cube')
    expect(shape?.type === 'mesh' && shape.negative).toBe(false)
  })

  /** The repair a client reaches for when the fold ran backwards — one call, no undo. */
  it('folds a solid the other way round', async () => {
    const { wall, cube } = await shapes()
    await runAction('node.carve', { nodeIds: [wall, cube], operation: 'subtract' })
    const made = scene().nodes.find(node => node.type === 'carved')
    expect(made?.name).toBe('Mur')

    await runAction('node.carveInvert', { nodeId: made?.id ?? '' })

    expect(scene().nodes.find(node => node.type === 'carved')?.name).toBe('Cube')
  })

  it('refuses to flip what is not a solid', async () => {
    const { wall } = await shapes()

    expect(await runAction('node.carveInvert', { nodeId: wall })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('refuses to mark what carries no shape', async () => {
    await runAction('node.add', { kind: 'point', name: 'Lampe' })

    expect(
      await runAction('node.negate', { nodeIds: [nodeNamed('Lampe')?.id ?? ''] }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
  })
})
