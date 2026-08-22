import { describe, expect, it, vi } from 'vitest'
import { runtimeEndpointId } from '@shared/domain/aiRuntime'
import { MODEL_LOADERS } from '@shared/domain/localModel'
import { endpointOf, endpointsOf, engineDoorOf } from './localRuntimes'
import { endpointOfDoor } from './engineMemory'
import type { LocalModel } from '@shared/domain/localModel'
import { localModel } from '@shared/domain/localModel-fixtures'
import { fileRuntime, runtimeReadingsOf, type LocalRuntime } from './localRuntimes'

const parakeet = localModel({ id: 'parakeet', loader: 'sherpa-onnx' })
const llama = localModel({ id: 'llama3.2:3b', loader: 'ollama', files: [] })

const holding = (installed: string[]): LocalRuntime => ({
  read: () => Promise.resolve({ ready: true, installed: new Set(installed), loaded: new Set() }),
  install: () => Promise.resolve(),
  remove: () => Promise.resolve(),
})

describe('runtimeReadingsOf', () => {
  it('asks each loader once, for the models that name it', async () => {
    const seen: LocalModel[][] = []
    const runtimes = {
      'sherpa-onnx': {
        ...holding([]),
        read: (models: readonly LocalModel[]) => {
          seen.push([...models])
          return Promise.resolve({
            ready: true,
            installed: new Set<string>(),
            loaded: new Set<string>(),
          })
        },
      },
    }

    await runtimeReadingsOf(runtimes, [parakeet, localModel({ id: 'second' })], () => {})

    expect(seen).toHaveLength(1)
    expect(seen[0]).toHaveLength(2)
  })

  /**
   * 🛑 A runtime that is down THROWS, and the reason is REPORTED. Swallowed, it was invisible
   * everywhere: the screen can only ever say "not answering".
   */
  it('reads a runtime that raises as one that is not answering, and says why', async () => {
    const said: string[] = []
    const runtimes = {
      ollama: { ...holding([]), read: () => Promise.reject(new Error('ECONNREFUSED')) },
    }

    const readings = await runtimeReadingsOf(runtimes, [llama], (_loader, why) => said.push(why))

    expect(readings.get('ollama')).toEqual({
      ready: false,
      installed: new Set(),
      loaded: new Set(),
    })
    expect(said).toEqual([expect.stringContaining('ECONNREFUSED')])
  })

  // A loader with no line is shown, greyed, and explained — rather than vanishing from the list.
  it('reads a loader nothing wires as one that is not answering', async () => {
    const readings = await runtimeReadingsOf({}, [llama], () => {})

    expect(readings.get('ollama')).toEqual({
      ready: false,
      installed: new Set(),
      loaded: new Set(),
    })
  })

  it('keeps the answer of each loader to its own models', async () => {
    const readings = await runtimeReadingsOf(
      { 'sherpa-onnx': holding(['parakeet']), ollama: holding([]) },
      [parakeet, llama],
      () => {},
    )

    expect(readings.get('sherpa-onnx')?.installed.has('parakeet')).toBe(true)
    expect(readings.get('ollama')?.installed.has('llama3.2:3b')).toBe(false)
  })
})

describe('fileRuntime', () => {
  // Ready by construction: what would have to be answering is this process.
  it('holds a model whose files are all complete on disk', async () => {
    const runtime = fileRuntime({
      folderFor: () => '/models',
      isComplete: model => Promise.resolve(model.id === 'parakeet'),
      fetch: () => Promise.resolve(),
      removeFiles: () => Promise.resolve(),
    })

    await expect(runtime.read([parakeet, localModel({ id: 'other' })])).resolves.toEqual({
      ready: true,
      installed: new Set(['parakeet']),
      // It fetches weights and holds nothing between calls: what is resident is another
      // runtime's question entirely.
      loaded: new Set(),
    })
  })

  // It fetches weights; it holds no conversation, and the router must be able to see that.
  it('offers no conversation', () => {
    const runtime = fileRuntime({
      folderFor: () => '/models',
      isComplete: () => Promise.resolve(false),
      fetch: () => Promise.resolve(),
      removeFiles: () => Promise.resolve(),
    })

    expect(runtime.chat).toBeUndefined()
  })

  it('removes from the folder the model was filed under', async () => {
    const removeFiles = vi.fn(() => Promise.resolve())
    const runtime = fileRuntime({
      folderFor: () => '/elsewhere',
      isComplete: () => Promise.resolve(true),
      fetch: () => Promise.resolve(),
      removeFiles,
    })

    await runtime.remove(parakeet)

    expect(removeFiles).toHaveBeenCalledWith(parakeet, '/elsewhere')
  })
})

describe('the door a loader answers on', () => {
  it('is its embedded one when it holds the weights in its own process', () => {
    expect(endpointOf('llamacpp')).toBe(runtimeEndpointId('llamacpp', 'embedded'))
  })

  /**
   * The reason this stopped being a `Record`: one can only ever hold ONE door per loader, and the
   * same Python runtime answers for images and for meshes from two processes.
   */
  it('differs by modality for a loader that serves several', () => {
    expect(endpointOf('diffusers', 'image')).not.toBe(endpointOf('diffusers', 'mesh'))
    expect(endpointOf('ollama', 'image')).not.toBe(endpointOf('ollama'))
  })

  it('falls back rather than minting a door for a modality nobody declared', () => {
    expect(endpointOf('diffusers', 'unheard-of')).toBe(endpointOf('diffusers'))
  })
})

describe('every door a loader answers on', () => {
  /** An inverse map is built from this: a door missing here has no loader, and a plan throws. */
  it('holds each of them once', () => {
    expect([...endpointsOf('diffusers')].sort()).toEqual([
      runtimeEndpointId('diffusers', '3d'),
      runtimeEndpointId('diffusers', 'audio'),
      runtimeEndpointId('diffusers', 'diffusion'),
      runtimeEndpointId('diffusers', 'video'),
    ])
  })

  it('covers what `endpointOf` can answer, for every loader', () => {
    for (const loader of MODEL_LOADERS) {
      expect(endpointsOf(loader)).toContain(endpointOf(loader))
    }
  })
})

describe('engineDoorOf', () => {
  it('names the door the engine itself answers under', () => {
    expect(engineDoorOf('image')).toBe('engine/diffusion')
  })

  // A door is what a release plan KILLS, and a video model weighs tens of gigabytes: co-located,
  // freeing one would take the other down with it.
  it('gives a video a process of its own rather than the image one', () => {
    expect(engineDoorOf('video')).not.toBe(engineDoorOf('image'))
  })

  // `endpointOfDoor` reads the same format the other way, and a key not minted here fails to
  // index the record it addresses.
  it('mints what the memory ledger reads back', () => {
    expect(endpointOfDoor(engineDoorOf('mesh'))).toBe(engineDoorOf('mesh'))
  })
})
