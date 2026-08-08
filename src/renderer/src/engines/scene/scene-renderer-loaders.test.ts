import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SceneRenderer } from './SceneRenderer'

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
