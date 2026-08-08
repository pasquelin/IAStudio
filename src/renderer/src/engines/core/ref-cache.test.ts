import { describe, expect, it, vi } from 'vitest'
import { createRefCache } from './ref-cache'

/** A load whose settling the test controls, which is what makes the in-flight races reachable. */
function deferred() {
  const pending = new Map<string, (value: string) => void>()

  return {
    load: (key: string) => new Promise<string>(resolve => pending.set(key, resolve)),
    settle: (key: string): void => pending.get(key)?.(`value:${key}`),
  }
}

describe('createRefCache', () => {
  it('loads once, however many holders ask', async () => {
    const load = vi.fn(async (key: string) => key)
    const cache = createRefCache({ load, free: () => {}, onFailure: () => {} })

    const [first, second] = await Promise.all([cache.acquire('a'), cache.acquire('a')])

    expect(load).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('frees at the last release, and not before', async () => {
    const free = vi.fn()
    const cache = createRefCache({ load: async (key: string) => key, free, onFailure: () => {} })

    await cache.acquire('a')
    await cache.acquire('a')

    cache.release('a')
    expect(free).not.toHaveBeenCalled()

    cache.release('a')
    expect(free).toHaveBeenCalledWith('a')
  })

  // The subtle one, and the reason this is written once rather than per cache.
  it('frees what arrives for a holder that let go while it was in flight', async () => {
    const free = vi.fn()
    const source = deferred()
    const cache = createRefCache({ load: source.load, free, onFailure: () => {} })

    const acquired = cache.acquire('a')
    cache.release('a')
    source.settle('a')

    expect(await acquired).toBeNull()
    expect(free).toHaveBeenCalledWith('value:a')
  })

  it('loads again for a key asked for after it was freed', async () => {
    const load = vi.fn(async (key: string) => key)
    const cache = createRefCache({ load, free: () => {}, onFailure: () => {} })

    await cache.acquire('a')
    cache.release('a')
    await cache.acquire('a')

    expect(load).toHaveBeenCalledTimes(2)
  })

  it('answers nothing for a failure, and tries again next time', async () => {
    let attempt = 0
    const load = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('gone')
      return 'ok'
    })
    const cache = createRefCache({ load, free: () => {}, onFailure: () => {} })

    expect(await cache.acquire('a')).toBeNull()
    expect(await cache.acquire('a')).toBe('ok')
  })

  it('tells what failed, and what it was loading', async () => {
    const onFailure = vi.fn()
    const gone = new Error('gone')
    const cache = createRefCache({
      load: () => Promise.reject(gone),
      free: () => {},
      onFailure,
    })

    await cache.acquire('a')

    expect(onFailure).toHaveBeenCalledWith('a', gone)
  })

  /**
   * The mirror of the in-flight release above, on the failing side. A stale load that rejects
   * must blame nothing: the holder it belonged to is gone, another one is being served, and a
   * reported failure would name a file the scene is about to draw.
   */
  it('says nothing when the load that failed is one nobody waits for any more', async () => {
    const onFailure = vi.fn()
    // Every load, not the last: two are in flight at once here, and rejecting the wrong one
    // would leave the first pending for ever.
    const rejects: ((reason: Error) => void)[] = []
    const cache = createRefCache({
      load: () => new Promise<string>((_resolve, reject) => rejects.push(reject)),
      free: () => {},
      onFailure,
    })

    const stale = cache.acquire('a')
    cache.release('a')
    void cache.acquire('a')
    rejects[0]?.(new Error('gone'))

    expect(await stale).toBeNull()
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('never frees what never loaded', async () => {
    const free = vi.fn()
    const cache = createRefCache({
      load: async () => {
        throw new Error('gone')
      },
      free,
      onFailure: () => {},
    })

    await cache.acquire('a')
    cache.dispose()

    expect(free).not.toHaveBeenCalled()
  })

  it('frees everything on dispose, whoever still holds it', async () => {
    const free = vi.fn()
    const cache = createRefCache({ load: async (key: string) => key, free, onFailure: () => {} })

    await cache.acquire('a')
    await cache.acquire('b')
    cache.dispose()

    expect(free.mock.calls.flat()).toEqual(['a', 'b'])
  })

  // Releasing more than was taken is a bug in the caller, not a reason to free twice.
  it('ignores a release for a key nobody holds', () => {
    const free = vi.fn()
    const cache = createRefCache({ load: async (key: string) => key, free, onFailure: () => {} })

    cache.release('never-taken')
    expect(free).not.toHaveBeenCalled()
  })
})
