import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { createCatalogClient, type CatalogPort } from './catalog-client'
import { dispatchCatalogRequest } from './catalog-dispatch'
import { createCatalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
import { ABANDONED, isAbandon, type CatalogMessage, type CatalogResponse } from './catalog-protocol'
import type { Asset } from '@shared/domain/asset'

/** The DOM lib is not on this target: the signal's own signature is where the type lives. */
type AbortListener = Parameters<AbortSignal['addEventListener']>[1]

const asset: Asset = {
  id: 'asset-1',
  name: 'sunset concept',
  type: 'image',
  location: 'local',
  tags: ['sky'],
  createdAt: '2026-08-07T10:00:00.000Z',
}

/** A port wired to a real catalogue, answering on the next microtask like a thread would. */
function loopbackPort(): CatalogPort & { requests: CatalogMessage[] } {
  const catalog = createCatalog(openMemoryDatabase())
  // After the test, not on `terminate`: a test that never closes the client would leak the
  // handle, and a `terminate` that also closed would close a second time and throw.
  onTestFinished(catalog.close)
  const requests: CatalogMessage[] = []
  let listener: ((response: CatalogResponse) => void) | null = null

  return {
    requests,
    postMessage: message => {
      requests.push(message)
      if (isAbandon(message)) return
      void Promise.resolve().then(() => listener?.(dispatchCatalogRequest(catalog, message)))
    },
    onMessage: next => {
      listener = next
    },
    onFailure: () => {},
    terminate: () => Promise.resolve(),
  }
}

/** A port that records requests and lets the test answer them by hand, in any order. */
function manualPort(): CatalogPort & {
  requests: CatalogMessage[]
  answer: (response: CatalogResponse) => void
  fail: (error: Error) => void
} {
  let listener: ((response: CatalogResponse) => void) | null = null
  let onFailure: ((error: Error) => void) | null = null
  const requests: CatalogMessage[] = []

  return {
    requests,
    postMessage: message => {
      requests.push(message)
    },
    onMessage: next => {
      listener = next
    },
    onFailure: next => {
      onFailure = next
    },
    terminate: () => Promise.resolve(),
    answer: response => listener?.(response),
    fail: error => onFailure?.(error),
  }
}

/**
 * The abort listeners a signal is actually holding. Counting them is what makes "nothing was
 * left behind" a measurement rather than an assurance — three cases read it.
 */
function trackedListeners(signal: AbortSignal): { signal: AbortSignal; held: AbortListener[] } {
  const held: AbortListener[] = []
  vi.spyOn(signal, 'addEventListener').mockImplementation((_type, listener) => {
    held.push(listener)
  })
  vi.spyOn(signal, 'removeEventListener').mockImplementation((_type, listener) => {
    const index = held.indexOf(listener)
    if (index >= 0) held.splice(index, 1)
  })
  return { signal, held }
}

describe('createCatalogClient', () => {
  it('resolves add with the asset the worker answered', async () => {
    const catalog = createCatalogClient(loopbackPort())

    await expect(catalog.add(asset)).resolves.toEqual(asset)
  })

  it('resolves find with the asset once it has been added', async () => {
    const catalog = createCatalogClient(loopbackPort())
    await catalog.add(asset)

    await expect(catalog.find('asset-1')).resolves.toEqual(asset)
  })

  it('resolves search with the page the worker answered', async () => {
    const catalog = createCatalogClient(loopbackPort())
    await catalog.add(asset)

    await expect(catalog.search({ limit: 10 })).resolves.toEqual([asset])
  })

  it('resolves the totals the worker counted', async () => {
    const catalog = createCatalogClient(loopbackPort())
    await catalog.add(asset)

    await expect(catalog.countByType()).resolves.toMatchObject({ image: 1, video: 0 })
  })

  /**
   * A search given up on stops costing both sides: this one stops waiting, and the thread is
   * told, so it can skip the query if it has not begun it.
   */
  it('tells the thread about a search given up on, and stops waiting for it', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)
    const controller = new AbortController()

    const search = catalog.search({ text: 'mos' }, controller.signal)
    controller.abort()

    await expect(search).rejects.toThrow(ABANDONED)
    expect(port.requests.filter(isAbandon)).toEqual([{ op: 'abandon', target: 1 }])
  })

  /** An answer to a search already given up on settles nothing and is not an error either. */
  it('ignores the answer to a search it already gave up on', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)
    const controller = new AbortController()

    const search = catalog.search({ text: 'mos' }, controller.signal)
    controller.abort()
    await expect(search).rejects.toThrow(ABANDONED)

    expect(() => port.answer({ id: 1, ok: true, value: [] })).not.toThrow()
  })

  /** Nothing crosses the boundary for a search abandoned before it was ever sent. */
  it('sends nothing at all when the signal is already aborted', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)

    await expect(catalog.search({ text: 'mos' }, AbortSignal.abort())).rejects.toThrow(ABANDONED)

    expect(port.requests).toEqual([])
  })

  /**
   * The listener goes with the answer, and it is watched directly rather than through what it
   * would do: a signal outlives the one search it was handed to — a search field holds one for a
   * whole session — and every answered search would leave a closure hanging off it.
   *
   * It is also what makes `abort` unreachable after a settle, which is why nothing guards that.
   */
  it('drops its abort listener once the search has answered', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)
    const listeners = trackedListeners(new AbortController().signal)

    const search = catalog.search({ text: 'mos' }, listeners.signal)
    expect(listeners.held).toHaveLength(1)

    port.answer({ id: 1, ok: true, value: [] })
    await search

    expect(listeners.held).toEqual([])
  })

  /** The same, for the other way a request settles: the thread died, or the project closed. */
  it('drops its abort listener when the catalogue closes under it', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)
    const listeners = trackedListeners(new AbortController().signal)

    const search = catalog.search({ text: 'mos' }, listeners.signal)
    await catalog.close()
    await expect(search).rejects.toThrow(/closed/)

    expect(listeners.held).toEqual([])
  })

  /**
   * A port whose thread is gone throws instead of answering. The request is sent BEFORE it is
   * recorded so nothing survives that throw — no entry, and no listener on a signal the caller
   * still owns. Recorded first, the promise would never settle at all.
   */
  describe('a port that refuses the message', () => {
    const refusingPort = (): CatalogPort => ({
      postMessage: () => {
        throw new Error('port is closed')
      },
      onMessage: () => {},
      onFailure: () => {},
      terminate: () => Promise.resolve(),
    })

    it('rejects the caller rather than leaving it waiting for an answer', async () => {
      const catalog = createCatalogClient(refusingPort())

      await expect(catalog.find('a')).rejects.toThrow(/port is closed/)
    })

    it('leaves no abort listener on the signal the caller handed it', async () => {
      const catalog = createCatalogClient(refusingPort())
      const listeners = trackedListeners(new AbortController().signal)

      await expect(catalog.search({ text: 'mos' }, listeners.signal)).rejects.toThrow()

      expect(listeners.held).toEqual([])
    })

    /**
     * The other side of the same story: the port dies while a search is still out, and the
     * caller gives up. A throw from inside an `abort` listener surfaces nowhere useful.
     */
    it('still says a search was abandoned when the abandon cannot be sent', async () => {
      const port = manualPort()
      let refuses = false
      const catalog = createCatalogClient({
        ...port,
        postMessage: message => {
          if (refuses) throw new Error('port is closed')
          port.postMessage(message)
        },
      })
      const controller = new AbortController()

      const search = catalog.search({ text: 'mos' }, controller.signal)
      refuses = true
      expect(() => controller.abort()).not.toThrow()

      await expect(search).rejects.toThrow(ABANDONED)
    })
  })

  it('gives every request its own id, so two in flight do not collide', async () => {
    const port = loopbackPort()
    const catalog = createCatalogClient(port)

    await Promise.all([catalog.find('a'), catalog.find('b'), catalog.find('c')])

    const ids = port.requests.flatMap(request => (isAbandon(request) ? [] : [request.id]))
    expect(new Set(ids).size).toBe(3)
  })

  // Out-of-order answers are the normal case the moment two queries differ in cost.
  it('settles each promise from its own id, whatever order the answers arrive in', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)

    const first = catalog.find('first')
    const second = catalog.find('second')

    port.answer({ id: 2, ok: true, value: asset })
    port.answer({ id: 1, ok: true, value: null })

    await expect(second).resolves.toEqual(asset)
    await expect(first).resolves.toBeNull()
  })

  it('rejects the matching promise when the worker reports a failure', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)

    const pending = catalog.search({})
    port.answer({ id: 1, ok: false, error: 'disk is full' })

    await expect(pending).rejects.toThrow('disk is full')
  })

  it('ignores an answer to a request it no longer holds', async () => {
    const port = manualPort()
    createCatalogClient(port)

    expect(() => port.answer({ id: 999, ok: true, value: null })).not.toThrow()
  })

  it('terminates the port on close', async () => {
    const port = manualPort()
    const terminate = vi.spyOn(port, 'terminate')
    const catalog = createCatalogClient(port)

    await catalog.close()

    expect(terminate).toHaveBeenCalledOnce()
  })

  // A thread that dies answers nothing: without this the interface waits on that promise for
  // the rest of the session.
  it('rejects what is in flight when the thread dies', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)

    const pending = catalog.search({})
    port.fail(new Error('worker crashed'))

    await expect(pending).rejects.toThrow('worker crashed')
  })

  it('refuses new work once the thread has died', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)

    port.fail(new Error('worker crashed'))

    await expect(catalog.find('anything')).rejects.toThrow(/closed/i)
  })

  // Closing while a search is in flight must not leave the caller waiting forever.
  it('rejects what is still in flight when it closes', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)

    const pending = catalog.search({})
    await catalog.close()

    await expect(pending).rejects.toThrow(/closed/i)
  })
})
