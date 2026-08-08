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
    const cache = createRefCache({ load, free: () => {} })

    const [first, second] = await Promise.all([cache.acquire('a'), cache.acquire('a')])

    expect(load).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('frees at the last release, and not before', async () => {
    const free = vi.fn()
    const cache = createRefCache({ load: async (key: string) => key, free })

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
    const cache = createRefCache({ load: source.load, free })

    const acquired = cache.acquire('a')
    cache.release('a')
    source.settle('a')

    expect(await acquired).toBeNull()
    expect(free).toHaveBeenCalledWith('value:a')
  })

  it('loads again for a key asked for after it was freed', async () => {
    const load = vi.fn(async (key: string) => key)
    const cache = createRefCache({ load, free: () => {} })

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
    const cache = createRefCache({ load, free: () => {} })

    expect(await cache.acquire('a')).toBeNull()
    expect(await cache.acquire('a')).toBe('ok')
  })

  it('never frees what never loaded', async () => {
    const free = vi.fn()
    const cache = createRefCache({
      load: async () => {
        throw new Error('gone')
      },
      free,
    })

    await cache.acquire('a')
    cache.dispose()

    expect(free).not.toHaveBeenCalled()
  })

  it('frees everything on dispose, whoever still holds it', async () => {
    const free = vi.fn()
    const cache = createRefCache({ load: async (key: string) => key, free })

    await cache.acquire('a')
    await cache.acquire('b')
    cache.dispose()

    expect(free.mock.calls.flat()).toEqual(['a', 'b'])
  })

  // Releasing more than was taken is a bug in the caller, not a reason to free twice.
  it('ignores a release for a key nobody holds', () => {
    const free = vi.fn()
    const cache = createRefCache({ load: async (key: string) => key, free })

    cache.release('never-taken')
    expect(free).not.toHaveBeenCalled()
  })
})
