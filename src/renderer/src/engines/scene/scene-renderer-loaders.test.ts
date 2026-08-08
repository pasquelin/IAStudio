import { describe, expect, it, vi } from 'vitest'
import { SceneRenderer } from './SceneRenderer'

const disposeDraco = vi.fn()
const disposeKtx2 = vi.fn()

/**
 * The two decoders, stood in for. What is under test is not their own `dispose` — three.js owns
 * that — but whether the engine can still reach them once the cache holds the load function alone.
 */
vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
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
  // Never mounted: the decoders are built in the constructor, and freeing them needs no GL.
  const engine = () => new SceneRenderer({ onSelect: () => {}, onTransform: () => {} })

  // Both hold Web Workers once a compressed model has been parsed, and an engine is rebuilt every
  // time a panel is detached — so a cycle that skipped this would leave a pool behind each time.
  it('ends the decoders it built when the engine is disposed', () => {
    engine().dispose()

    expect(disposeDraco).toHaveBeenCalled()
    expect(disposeKtx2).toHaveBeenCalled()
  })

  it('builds no decoder at all when a source is injected', () => {
    vi.clearAllMocks()

    new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      loadModel: () => Promise.reject(new Error('never asked')),
    }).dispose()

    expect(disposeDraco).not.toHaveBeenCalled()
    expect(disposeKtx2).not.toHaveBeenCalled()
  })
})
