import { Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createTextureCache, type TextureSource } from './texture-cache'

/** A loader whose answers are handed out by the test, one deferred promise per URL. */
function deferredSource() {
  const pending = new Map<string, (texture: Texture) => void>()
  const rejects = new Map<string, (reason: Error) => void>()
  const calls: string[] = []

  const load: TextureSource = url => {
    calls.push(url)
    return new Promise<Texture>((resolve, reject) => {
      pending.set(url, resolve)
      rejects.set(url, reject)
    })
  }

  const urlOf = (assetId: string) => `scenario://asset/${assetId}`

  return {
    load,
    calls,
    settle: (assetId: string, texture = new Texture()) => {
      pending.get(urlOf(assetId))?.(texture)
      return texture
    },
    fail: (assetId: string) => rejects.get(urlOf(assetId))?.(new Error('gone')),
  }
}

describe('createTextureCache', () => {
  it('loads a texture from the asset it names', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    const loading = cache.acquire('tex-1')
    const texture = source.settle('tex-1')

    expect(source.calls).toEqual(['scenario://asset/tex-1'])
    await expect(loading).resolves.toBe(texture)
  })

  // Ten meshes sharing one 4K map should upload it once.
  it('loads once for however many holders', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    const first = cache.acquire('tex-1')
    const second = cache.acquire('tex-1')
    const texture = source.settle('tex-1')

    expect(source.calls).toHaveLength(1)
    await expect(first).resolves.toBe(texture)
    await expect(second).resolves.toBe(texture)
  })

  it('frees the texture once the last holder lets go', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    void cache.acquire('tex-1')
    void cache.acquire('tex-1')
    const texture = source.settle('tex-1')
    await Promise.resolve()
    const dispose = vi.spyOn(texture, 'dispose')

    cache.release('tex-1')
    expect(dispose).not.toHaveBeenCalled()

    cache.release('tex-1')
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  // A texture nobody wants any more must not come back to life when it finally arrives.
  it('frees a texture released while it was still loading', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    const loading = cache.acquire('tex-1')
    cache.release('tex-1')

    const texture = new Texture()
    const dispose = vi.spyOn(texture, 'dispose')
    source.settle('tex-1', texture)

    await expect(loading).resolves.toBeNull()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('loads again for a texture asked for after it was freed', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    void cache.acquire('tex-1')
    source.settle('tex-1')
    await Promise.resolve()
    cache.release('tex-1')

    void cache.acquire('tex-1')
    expect(source.calls).toHaveLength(2)
  })

  // A file that moved is an ordinary thing in a project, not a reason for the panel to break.
  it('answers with nothing when the texture cannot be loaded', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    const loading = cache.acquire('tex-1')
    source.fail('tex-1')

    await expect(loading).resolves.toBeNull()
  })

  it('retries a texture that failed rather than caching the failure', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    const loading = cache.acquire('tex-1')
    source.fail('tex-1')
    await loading

    void cache.acquire('tex-1')
    expect(source.calls).toHaveLength(2)
  })

  it('ignores a release nobody was holding', () => {
    const cache = createTextureCache(deferredSource().load)

    expect(() => cache.release('never-loaded')).not.toThrow()
  })

  it('frees everything it still holds when the engine goes', async () => {
    const source = deferredSource()
    const cache = createTextureCache(source.load)

    void cache.acquire('tex-1')
    void cache.acquire('tex-2')
    const first = source.settle('tex-1')
    const second = source.settle('tex-2')
    await Promise.resolve()

    const disposals = [vi.spyOn(first, 'dispose'), vi.spyOn(second, 'dispose')]
    cache.dispose()

    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1)
  })
})
