import type { WebGLRenderer } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGltfSource } from './gltf-source'

const loadAsync = vi.fn(() => Promise.resolve({ scene: { name: 'root' } }))
const detectSupport = vi.fn()
const setDecoderPath = vi.fn()
const setTranscoderPath = vi.fn()
const setDRACOLoader = vi.fn()
const setKTX2Loader = vi.fn()

/**
 * The three loaders, stood in for. jsdom fetches no decoder and has no GPU to ask, and what this
 * module is about is the wiring around them: which paths they are given, and when the GPU is
 * questioned.
 */
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    loadAsync = loadAsync
    setDRACOLoader = setDRACOLoader
    setKTX2Loader = setKTX2Loader
  },
}))

vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    setDecoderPath = (path: string) => {
      setDecoderPath(path)
      return this
    }
  },
}))

vi.mock('three/addons/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    detectSupport = detectSupport
    setTranscoderPath = (path: string) => {
      setTranscoderPath(path)
      return this
    }
  },
}))

// `as`: the loader reads a dozen fields off a renderer, and none of them is read here.
const fakeGpu = () => ({}) as WebGLRenderer

describe('createGltfSource', () => {
  beforeEach(vi.clearAllMocks)

  // Served by the application itself, never fetched from a CDN: the window policy forbids it,
  // and loading a model must not depend on the network.
  it('points both decoders at the folder the application ships them in', () => {
    createGltfSource(() => null)

    expect(setDecoderPath).toHaveBeenCalledWith('/decoders/draco/')
    expect(setTranscoderPath).toHaveBeenCalledWith('/decoders/basis/')
  })

  it('hands both decoders to the loader that needs them', () => {
    createGltfSource(() => null)

    expect(setDRACOLoader).toHaveBeenCalled()
    expect(setKTX2Loader).toHaveBeenCalled()
  })

  it('reads the scene out of what the loader brings back', async () => {
    const source = await createGltfSource(() => null)('scenario://asset/mesh-1')

    expect(source).toEqual({ name: 'root' })
    expect(loadAsync).toHaveBeenCalledWith('scenario://asset/mesh-1')
  })

  // The viewport has no renderer until it is mounted, while the source is built in the engine's
  // constructor: asking too early would settle the support table on nothing.
  it('asks the GPU what it can transcode as soon as there is one', async () => {
    await createGltfSource(fakeGpu)('scenario://asset/mesh-1')

    expect(detectSupport).toHaveBeenCalled()
  })

  it('asks it once, however many models are loaded', async () => {
    const source = createGltfSource(fakeGpu)

    await source('scenario://asset/mesh-1')
    await source('scenario://asset/mesh-2')

    expect(detectSupport).toHaveBeenCalledTimes(1)
  })

  // A model can be asked for before the viewport is mounted; it must load all the same, and the
  // GPU must still be asked once it is there.
  it('loads without a GPU, and asks the one that turns up later', async () => {
    let gpu: WebGLRenderer | null = null
    const source = createGltfSource(() => gpu)

    await source('scenario://asset/mesh-1')
    expect(detectSupport).not.toHaveBeenCalled()

    gpu = fakeGpu()
    await source('scenario://asset/mesh-2')
    expect(detectSupport).toHaveBeenCalledTimes(1)
  })
})
