import { AnimationClip, Group, Mesh, SphereGeometry, VectorKeyframeTrack } from 'three'
import type { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { AnimationRef } from '@shared/domain/scene'
import { DEFAULT_ANIMATION } from '@shared/domain/scene'
import { SceneRenderer } from './SceneRenderer'
import type { BvhBuilder } from './bvh-builder'
import type * as ModelCache from './model-cache'
import { modelNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE } from './scene-state'

/**
 * The instance the scene mounts is a clone, which nothing outside the engine can reach. Handing
 * the source back in its place is what makes the mixer's work observable — and it is the source's
 * clips that drive it either way, since `Object3D.copy` carries none.
 */
vi.mock('./model-cache', async importOriginal => ({
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

const modelNode = (animation: AnimationRef | null) => ({
  ...modelNodeFixture('a'),
  model: { assetId: 'asset-1', ...(animation && { animation }) },
})

describe('SceneRenderer and the clips a model brought', () => {
  it('poses the model where the document says, without waiting for a frame', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode({ ...DEFAULT_ANIMATION, clip: 'walk', time: 0.5 })],
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
      nodes: [modelNode({ ...DEFAULT_ANIMATION, clip: 'walk', time: 0 })],
    })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode({ ...DEFAULT_ANIMATION, clip: 'walk', time: 0.25 })],
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
      nodes: [modelNode({ ...DEFAULT_ANIMATION, clip: 'walk', time: 0.5 })],
    })
    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))

    engine.apply(EMPTY_SCENE)

    // With no action left driving it, three puts back the value the file was loaded with.
    expect(cubeOf(loaded).position.x).toBe(0)
    engine.dispose()
  })
})
