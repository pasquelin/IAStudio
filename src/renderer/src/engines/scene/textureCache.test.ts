import { NoColorSpace, SRGBColorSpace, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createTextureCache, type TextureSource } from './textureCache'

/** The failure port, silent unless a test watches it — the renderer's log is not this module's. */
const silent = () => {}

/**
 * A loader whose answers are handed out by the test. It keeps every pending load of a URL, not
 * just the last: one asset can be loaded twice at once, once per colour space, and each load
 * decodes an image of its own.
 */
function deferredSource() {
  const pending = new Map<string, ((texture: Texture) => void)[]>()
  const rejects = new Map<string, ((reason: Error) => void)[]>()
  const calls: string[] = []

  const queue = <T>(map: Map<string, T[]>, url: string, value: T): void => {
    const waiting = map.get(url)
    if (waiting) waiting.push(value)
    else map.set(url, [value])
  }

  const load: TextureSource = url => {
    calls.push(url)
    return new Promise<Texture>((resolve, reject) => {
      queue(pending, url, resolve)
      queue(rejects, url, reject)
    })
  }

  const urlOf = (assetId: string) => `scenario://asset/${assetId}`

  return {
    load,
    calls,
    settle: (assetId: string, texture = new Texture()) => {
      const waiting = pending.get(urlOf(assetId)) ?? []
      pending.delete(urlOf(assetId))
      // The first holder gets the texture the test named; anyone else waiting gets its own.
      waiting.forEach((resolve, index) => resolve(index === 0 ? texture : new Texture()))
      return texture
    },
    fail: (assetId: string) => {
      for (const reject of rejects.get(urlOf(assetId)) ?? []) reject(new Error('gone'))
    },
  }
}

describe('createTextureCache', () => {
  it('loads a texture from the asset it names', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const loading = cache.acquire('tex-1', NoColorSpace)
    const texture = source.settle('tex-1')

    expect(source.calls).toEqual(['scenario://asset/tex-1'])
    await expect(loading).resolves.toBe(texture)
  })

  // Ten meshes sharing one 4K map should upload it once.
  it('loads once for however many holders', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const first = cache.acquire('tex-1', NoColorSpace)
    const second = cache.acquire('tex-1', NoColorSpace)
    const texture = source.settle('tex-1')

    expect(source.calls).toHaveLength(1)
    await expect(first).resolves.toBe(texture)
    await expect(second).resolves.toBe(texture)
  })

  it('frees the texture once the last holder lets go', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const acquired = cache.acquire('tex-1', NoColorSpace)
    void cache.acquire('tex-1', NoColorSpace)
    const texture = source.settle('tex-1')
    // The promise, not a tick: what is being waited for is the load, not a count of microtasks.
    await acquired
    const dispose = vi.spyOn(texture, 'dispose')

    cache.release('tex-1', NoColorSpace)
    expect(dispose).not.toHaveBeenCalled()

    cache.release('tex-1', NoColorSpace)
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  // A texture nobody wants any more must not come back to life when it finally arrives.
  it('frees a texture released while it was still loading', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const loading = cache.acquire('tex-1', NoColorSpace)
    cache.release('tex-1', NoColorSpace)

    const texture = new Texture()
    const dispose = vi.spyOn(texture, 'dispose')
    source.settle('tex-1', texture)

    await expect(loading).resolves.toBeNull()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('loads again for a texture asked for after it was freed', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const acquired = cache.acquire('tex-1', NoColorSpace)
    source.settle('tex-1')
    await acquired
    cache.release('tex-1', NoColorSpace)

    void cache.acquire('tex-1', NoColorSpace)
    expect(source.calls).toHaveLength(2)
  })

  // A file that moved is an ordinary thing in a project, not a reason for the panel to break.
  it('answers with nothing when the texture cannot be loaded', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const loading = cache.acquire('tex-1', NoColorSpace)
    source.fail('tex-1')

    await expect(loading).resolves.toBeNull()
  })

  // An empty slot says nothing on its own: the material simply looks untextured. The asset, not
  // the key: which colour space it was read in says nothing to a reader.
  it('tells which texture failed to load, without its colour space', async () => {
    const onFailure = vi.fn()
    const source = deferredSource()

    const loading = createTextureCache(source.load, onFailure).acquire('tex-1', SRGBColorSpace)
    source.fail('tex-1')
    await loading

    expect(onFailure).toHaveBeenCalledWith('tex-1', expect.any(Error))
  })

  it('retries a texture that failed rather than caching the failure', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const loading = cache.acquire('tex-1', NoColorSpace)
    source.fail('tex-1')
    await loading

    void cache.acquire('tex-1', NoColorSpace)
    expect(source.calls).toHaveLength(2)
  })

  it('ignores a release nobody was holding', () => {
    const cache = createTextureCache(deferredSource().load, silent)

    expect(() => cache.release('never-loaded', NoColorSpace)).not.toThrow()
  })

  // The same picture read as colour and as data are two textures on the GPU: setting the colour
  // space on one shared instance would silently wash out the other.
  it('keeps one texture per colour space', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const asColour = cache.acquire('tex-1', SRGBColorSpace)
    const asData = cache.acquire('tex-1', NoColorSpace)
    source.settle('tex-1')

    expect(source.calls).toHaveLength(2)
    expect((await asColour)?.colorSpace).toBe(SRGBColorSpace)
    expect((await asData)?.colorSpace).toBe(NoColorSpace)
  })

  it('frees everything it still holds when the engine goes', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    const acquired = Promise.all([
      cache.acquire('tex-1', NoColorSpace),
      cache.acquire('tex-2', NoColorSpace),
    ])
    const first = source.settle('tex-1')
    const second = source.settle('tex-2')
    await acquired

    const disposals = [vi.spyOn(first, 'dispose'), vi.spyOn(second, 'dispose')]
    cache.dispose()

    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1)
  })

  /**
   * The id of an overwritten picture does not move, so a bare URL comes back from the browser's
   * own cache: a ⌘S over a texture looked like a gesture that did nothing.
   */
  it('stamps the URL with what the catalogue says the file was written at', () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent, () => '2026-08-13T10:00:00.000Z')

    void cache.acquire('tex-1', NoColorSpace, '2026-08-13T10:00:00.000Z')

    expect(source.calls).toEqual(['scenario://asset/tex-1?v=2026-08-13T10%3A00%3A00.000Z'])
  })

  it('reads the same asset again when its version moved', () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load, silent)

    void cache.acquire('tex-1', NoColorSpace, 'before')
    void cache.acquire('tex-1', NoColorSpace, 'after')

    expect(source.calls).toHaveLength(2)
  })
})

const SOURCES: Record<string, string> = import.meta.glob(
  ['../../**/*.ts', '../../**/*.tsx', '!../../**/*.test.ts', '!../../**/*.test.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * `loadTexture` exists so the one implementation lives on one line — the JSDoc above it says
 * three spaces had already grown their own copy. A fourth had grown back inside `SceneRenderer`,
 * which built a `TextureLoader` of its own to fill the very port this module declares.
 */
describe('the one texture loader', () => {
  it('is built in exactly one place', () => {
    const building = Object.entries(SOURCES)
      .filter(([, source]) => source.includes('new TextureLoader('))
      .map(([path]) => path)

    expect(building).toEqual(['./textureCache.ts'])
  })
})
