import { AnimationClip, Bone, Group, Mesh, SphereGeometry, VectorKeyframeTrack } from 'three'
import type { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { embeddedClip, type ClipRef } from '@shared/domain/scene'
import { SceneRenderer } from './SceneRenderer'
import type { BvhBuilder } from './bvhBuilder'
import type * as ModelCache from './modelCache'
import { meshNode, modelNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE } from './sceneState'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'

/**
 * The instance the scene mounts is a clone, which nothing outside the engine can reach. Handing
 * the source back in its place is what makes the mixer's work observable — and it is the source's
 * clips that drive it either way, since `Object3D.copy` carries none.
 */
vi.mock('./modelCache', async importOriginal => ({
  ...(await importOriginal<typeof ModelCache>()),
  instanceOf: (source: Object3D) => source,
}))

/** A cube travelling one unit along X over one second. */
const walk = (name = 'walk'): AnimationClip =>
  new AnimationClip(name, 1, [new VectorKeyframeTrack('cube.position', [0, 1], [0, 0, 0, 1, 0, 0])])

function animatedModel(clips: AnimationClip[]): Group {
  const root = new Group()
  const cube = new Mesh(new SphereGeometry(1, 4, 4))
  cube.name = 'cube'
  root.add(cube)
  root.animations = clips
  return root
}

const cubeOf = (root: Group): Object3D => {
  const cube = root.getObjectByName('cube')
  if (!cube) throw new Error('the fixture builds one named child')
  return cube
}

/** No worker under vitest, and no tree is what this file is about. */
const bvh: BvhBuilder = { accelerate: () => Promise.resolve(), dispose: () => {} }

function withModel(loaded: Group): SceneRenderer {
  return new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    loadModel: () => Promise.resolve(loaded),
    bvh,
  })
}

const modelNode = (clip: ClipRef | null) => ({
  ...modelNodeFixture('a'),
  model: { assetId: 'asset-1', ...(clip && { clips: [clip] }) },
})

/** A block on `walk`, since that is the clip every fixture of this file brings. */
const walkBlock = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('block-1', 'walk', extra)

describe('SceneRenderer and the clips a model brought', () => {
  it('poses the model where the document says, without waiting for a frame', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0.5 }))],
    })

    // The file lands a tick after the sync that built its holder; the pose lands with it.
    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))
    engine.dispose()
  })

  it('leaves a model at rest when the document names no clip', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    expect(cubeOf(loaded).position.x).toBe(0)
    engine.dispose()
  })

  it('follows the document when the head is moved on a model already on stage', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0 }))],
    })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0.25 }))],
    })

    expect(cubeOf(loaded).position.x).toBeCloseTo(0.25, 5)
    engine.dispose()
  })

  it('takes a model with no clip at all without complaining', async () => {
    const loaded = animatedModel([])
    const engine = withModel(loaded)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    engine.dispose()
  })

  it('lets go of the mixer when the node goes, so a released model keeps no bones alive', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0.5 }))],
    })
    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))

    engine.apply(EMPTY_SCENE)

    // With no action left driving it, three puts back the value the file was loaded with.
    expect(cubeOf(loaded).position.x).toBe(0)
    engine.dispose()
  })
})

describe('SceneRenderer and the bones a rig carries', () => {
  const rigged = (): Group => {
    const root = animatedModel([walk()])
    const bone = new Bone()
    bone.name = 'spine'
    root.add(bone)
    return root
  }

  /**
   * The helpers hang beside the nodes, so the scene is where they are counted — reached by
   * walking up from the mounted model rather than into the engine: holder, then scene.
   */
  const helpersAround = (loaded: Group): number =>
    (loaded.parent?.parent?.children ?? []).filter(child => child.type === 'SkeletonHelper').length

  it('draws no helper for a model that carries no bone', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    expect(helpersAround(loaded)).toBe(0)
    engine.dispose()
  })

  it('hangs one beside the nodes for a rigged model, hidden until asked for', async () => {
    const loaded = rigged()
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(helpersAround(loaded)).toBe(1))

    const helper = (loaded.parent?.parent?.children ?? []).find(
      child => child.type === 'SkeletonHelper',
    )
    expect(helper?.visible).toBe(false)

    engine.setSkeletons(true)
    expect(helper?.visible).toBe(true)
    engine.dispose()
  })

  it('takes the helper away with the node it belonged to', async () => {
    const loaded = rigged()
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })
    await vi.waitFor(() => expect(helpersAround(loaded)).toBe(1))

    // Kept before the node goes: the model is unparented with it, and the walk up would end early.
    const scene = loaded.parent?.parent
    engine.apply(EMPTY_SCENE)

    expect((scene?.children ?? []).filter(child => child.type === 'SkeletonHelper')).toHaveLength(0)
    engine.dispose()
  })
})

describe('SceneRenderer and the timeline over the scene', () => {
  const cube = meshNode('cube-1')

  const timelineWith = (value: number): AnimationTimeline => ({
    ...EMPTY_TIMELINE,
    tracks: [
      {
        id: 'track-1',
        name: 'Cube position',
        index: 0,
        muted: false,
        solo: false,
        locked: false,
        target: { nodeId: 'cube-1', property: 'position' },
        keys: [{ time: 0, value: { x: value, y: 0, z: 0 } }],
      },
    ],
  })

  /** The engine names its objects after their node, which is how one is found from outside. */
  const objectOf = (engine: SceneRenderer, id: string): Object3D | undefined => {
    const scene: { children: Object3D[] } = Reflect.get(engine, 'viewport').scene
    return scene.children.find(child => child.name === id)
  }

  it('lays what the tracks add over the pose the node holds', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply({ ...EMPTY_SCENE, nodes: [cube], animation: timelineWith(4) })

    expect(objectOf(engine, 'cube-1')?.position.x).toBe(4)
    engine.dispose()
  })

  it('follows the head without the document changing at all', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const one = timelineWith(0).tracks[0]
    if (!one) throw new Error('the fixture builds one track')

    const timeline: AnimationTimeline = {
      ...EMPTY_TIMELINE,
      tracks: [
        {
          ...one,
          keys: [
            { time: 0, value: { x: 0, y: 0, z: 0 } },
            { time: 2, value: { x: 10, y: 0, z: 0 } },
          ],
        },
      ],
    }
    engine.apply({ ...EMPTY_SCENE, nodes: [cube], animation: timeline })
    expect(objectOf(engine, 'cube-1')?.position.x).toBe(0)

    engine.setPlayhead(1)
    expect(objectOf(engine, 'cube-1')?.position.x).toBeCloseTo(5, 5)
    engine.dispose()
  })

  it('leaves a scene with no track exactly where its nodes stand', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply({ ...EMPTY_SCENE, nodes: [cube] })
    engine.setPlayhead(3)

    expect(objectOf(engine, 'cube-1')?.position.x).toBe(0)
    engine.dispose()
  })
})

describe('SceneRenderer and a track on one bone', () => {
  const boneTimeline = (value: number): AnimationTimeline => ({
    ...EMPTY_TIMELINE,
    tracks: [
      {
        id: 'track-bone',
        name: 'arm',
        index: 0,
        muted: false,
        solo: false,
        locked: false,
        target: { nodeId: 'a', bone: 'spine', property: 'position' },
        keys: [{ time: 0, value: { x: value, y: 0, z: 0 } }],
      },
    ],
  })

  it('moves the bone the track names, and leaves the model where it stands', async () => {
    const loaded = animatedModel([walk()])
    const bone = new Bone()
    bone.name = 'spine'
    loaded.add(bone)

    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)], animation: boneTimeline(3) })

    await vi.waitFor(() => expect(bone.position.x).toBe(3))
    // The model itself was never a target of that track.
    expect(loaded.parent?.position.x).toBe(0)
    engine.dispose()
  })

  it('lays the track over the pose the FILE gave the bone, not over zero', async () => {
    const loaded = animatedModel([walk()])
    const bone = new Bone()
    bone.name = 'spine'
    bone.position.set(10, 0, 0)
    loaded.add(bone)

    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)], animation: boneTimeline(3) })

    await vi.waitFor(() => expect(bone.position.x).toBe(13))
    engine.dispose()
  })
})
