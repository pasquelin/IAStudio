import {
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  type WebGLRenderer,
} from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGltfSource } from './gltf-source'

/**
 * A parsed file, as three hands it back: a scene of real objects, the definitions it was built
 * from, and the map tying the two together. Real three objects rather than shapes of our own —
 * what the counter reads is `material.map`, which only a `MeshStandardMaterial` truly has.
 *
 * `wants` are the texture slots the definition fills; `gets` the ones that made it onto the
 * material, which is what a refused blob leaves short.
 */
const parsed = ({
  wants = 0,
  gets = 0,
  unreferenced = 0,
}: { wants?: number; gets?: number; unreferenced?: number } = {}) => {
  const material = new MeshStandardMaterial()
  const slots: (keyof MeshStandardMaterial)[] = ['map', 'roughnessMap', 'normalMap']
  for (let index = 0; index < gets; index++) {
    Reflect.set(material, slots[index] ?? 'aoMap', new Texture())
  }

  const scene = new Group()
  scene.add(new Mesh(new BufferGeometry(), material))

  const declared: Record<string, { index: number }> = {}
  const names = ['baseColorTexture', 'normalTexture', 'occlusionTexture']
  for (let index = 0; index < wants; index++) {
    declared[names[index] ?? `extraTexture${index}`] = { index }
  }

  return {
    scene,
    animations: [],
    parser: {
      json: {
        materials: [{ name: 'PBR', pbrMetallicRoughness: declared }],
        // Declared by the file, referenced by nothing — the parse never loads these.
        textures: Array.from({ length: wants + unreferenced }, () => ({})),
      },
      associations: new Map([[material, { materials: 0 }]]),
    },
  }
}

const loadAsync = vi.fn(() => Promise.resolve(parsed()))
const detectSupport = vi.fn()
const setDecoderPath = vi.fn()
const setTranscoderPath = vi.fn()
const setDRACOLoader = vi.fn()
const setKTX2Loader = vi.fn()
const disposeDraco = vi.fn()
const disposeKtx2 = vi.fn()

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
    dispose = disposeDraco
    setDecoderPath = (path: string) => {
      setDecoderPath(path)
      return this
    }
  },
}))

vi.mock('three/addons/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    detectSupport = detectSupport
    dispose = disposeKtx2
    setTranscoderPath = (path: string) => {
      setTranscoderPath(path)
      return this
    }
  },
}))

const reportFailure = vi.fn()
vi.mock('@/services/diagnostics', () => ({
  reportFailure: (...args: unknown[]) => reportFailure(...args),
}))

// `as`: the loader reads a dozen fields off a renderer, and none of them is read here.
const fakeGpu = () => ({}) as WebGLRenderer

describe('createGltfSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadAsync.mockResolvedValue(parsed())
  })

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
    const source = await createGltfSource(() => null).load('scenario://asset/mesh-1')

    expect(source).toBeInstanceOf(Group)
    expect(loadAsync).toHaveBeenCalledWith('scenario://asset/mesh-1')
  })

  /**
   * The defect this exists for: three answers `null` for a texture it could not read and lets
   * the parse succeed, so a model whose textures were all refused arrives whole, white and
   * unreported — a window policy that refused them went unnoticed until the pixels were measured.
   */
  it('reports the textures a file asked for and did not get', async () => {
    loadAsync.mockResolvedValue(parsed({ wants: 2, gets: 0 }))

    await createGltfSource(() => null).load('scenario://asset/mesh-1')

    expect(reportFailure).toHaveBeenCalledWith(
      'scene.texture',
      'scenario://asset/mesh-1',
      expect.objectContaining({ message: '2/2' }),
    )
  })

  it('reports the ones missing when only some arrived', async () => {
    loadAsync.mockResolvedValue(parsed({ wants: 3, gets: 2 }))

    await createGltfSource(() => null).load('scenario://asset/mesh-1')

    expect(reportFailure).toHaveBeenCalledWith(
      'scene.texture',
      'scenario://asset/mesh-1',
      expect.objectContaining({ message: '1/3' }),
    )
  })

  it('says nothing about a file whose textures all arrived', async () => {
    loadAsync.mockResolvedValue(parsed({ wants: 2, gets: 2 }))

    await createGltfSource(() => null).load('scenario://asset/mesh-1')

    expect(reportFailure).not.toHaveBeenCalled()
  })

  // A model with no texture at all is the ordinary case, not a failure.
  it('says nothing about a file that asks for no texture', async () => {
    await createGltfSource(() => null).load('scenario://asset/mesh-1')

    expect(reportFailure).not.toHaveBeenCalled()
  })

  /**
   * A file may declare a texture no material references, which the parse never loads. Asking the
   * parser for it would DECODE it here — off a scene that will never show it, on the UI thread —
   * and answer a failure for a model that renders perfectly.
   */
  it('judges what the materials asked for, not what the file happens to hold', async () => {
    const gltf = parsed({ wants: 1, gets: 1, unreferenced: 3 })
    loadAsync.mockResolvedValue(gltf)

    await createGltfSource(() => null).load('scenario://asset/mesh-1')

    expect(reportFailure).not.toHaveBeenCalled()
  })

  // The viewport has no renderer until it is mounted, while the source is built in the engine's
  // constructor: asking too early would settle the support table on nothing.
  it('asks the GPU what it can transcode as soon as there is one', async () => {
    await createGltfSource(fakeGpu).load('scenario://asset/mesh-1')

    expect(detectSupport).toHaveBeenCalled()
  })

  it('asks it once, however many models are loaded', async () => {
    const source = createGltfSource(fakeGpu)

    await source.load('scenario://asset/mesh-1')
    await source.load('scenario://asset/mesh-2')

    expect(detectSupport).toHaveBeenCalledTimes(1)
  })

  // A model can be asked for before the viewport is mounted; it must load all the same, and the
  // GPU must still be asked once it is there.
  it('loads without a GPU, and asks the one that turns up later', async () => {
    let gpu: WebGLRenderer | null = null
    const source = createGltfSource(() => gpu)

    await source.load('scenario://asset/mesh-1')
    expect(detectSupport).not.toHaveBeenCalled()

    gpu = fakeGpu()
    await source.load('scenario://asset/mesh-2')
    expect(detectSupport).toHaveBeenCalledTimes(1)
  })

  // Both decoders spawn Web Workers on the first parse and hold them for good. An engine is
  // rebuilt every time a panel is detached, so nothing else ever ends them.
  it('ends both decoders when it is let go', async () => {
    const source = createGltfSource(fakeGpu)
    await source.load('scenario://asset/mesh-1')

    source.dispose()

    expect(disposeDraco).toHaveBeenCalled()
    expect(disposeKtx2).toHaveBeenCalled()
  })
})
