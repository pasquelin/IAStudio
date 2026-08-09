import { Group, Mesh, SphereGeometry } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SceneRenderer } from './SceneRenderer'
import type { BvhBuilder } from './bvh-builder'
import { modelNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE } from './scene-state'

const builtDraco = vi.fn()
const disposeDraco = vi.fn()
const disposeKtx2 = vi.fn()

/**
 * The two decoders, stood in for. What is under test is not their own `dispose` — three.js owns
 * that — but whether the engine can still reach them once the cache holds the load function alone.
 */
vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    constructor() {
      builtDraco()
    }
    dispose = disposeDraco
    setDecoderPath = () => this
  },
}))

vi.mock('three/addons/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    detectSupport = () => {}
    dispose = disposeKtx2
    setTranscoderPath = () => this
  },
}))

describe('SceneRenderer and the model decoders', () => {
  beforeEach(vi.clearAllMocks)

  // Never mounted: the decoders are built in the constructor, and freeing them needs no GL.
  const engine = (loadModel?: () => Promise<never>) =>
    new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      ...(loadModel && { loadModel }),
    })

  it('ends the decoders it built when the engine is disposed', () => {
    engine().dispose()

    expect(disposeDraco).toHaveBeenCalled()
    expect(disposeKtx2).toHaveBeenCalled()
  })

  // Asserted on the constructor, not on `dispose`: a decoder built and left alone would look the
  // same from the release side, and that is the leak this whole file is about.
  it('builds no decoder at all when a source is injected', () => {
    engine(() => Promise.reject(new Error('never asked'))).dispose()

    expect(builtDraco).not.toHaveBeenCalled()
  })
})

/**
 * A model is one node over a whole imported tree, and its meshes are accelerated one await at a
 * time. Letting the first failure out of that loop cost every mesh behind it its tree — for the
 * session, since nothing walks a loaded model a second time to ask again.
 */
describe('SceneRenderer and a tree that will not build', () => {
  const twoMeshes = (): Group => {
    const group = new Group()
    group.add(new Mesh(new SphereGeometry(1, 8, 8)), new Mesh(new SphereGeometry(1, 8, 8)))
    return group
  }

  it('asks for every mesh of a model even after one of them failed', async () => {
    const asked: Mesh[] = []
    const bvh: BvhBuilder = {
      accelerate: mesh => {
        asked.push(mesh)
        return asked.length === 1 ? Promise.reject(new Error('out of memory')) : Promise.resolve()
      },
      dispose: () => {},
    }

    const loaded = twoMeshes()
    const engine = new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      loadModel: () => Promise.resolve(loaded),
      bvh,
    })
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNodeFixture('a')] })
    // The model lands a tick after the sync that built its holder, and the walk a tick after that.
    await vi.waitFor(() => expect(asked).toHaveLength(2))

    engine.dispose()
  })
})
