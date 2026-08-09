import { describe, expect, it, vi } from 'vitest'
import { createCatalogClient, type CatalogPort } from './catalog-client'
import { dispatchCatalogRequest } from './catalog-dispatch'
import { createCatalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
import { ABANDONED, isAbandon, type CatalogMessage, type CatalogResponse } from './catalog-protocol'
import type { Asset } from '@shared/domain/asset'

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

  /** The listener goes with the answer: a signal outlives the one search it was handed to. */
  it('drops its abort listener once the search has answered', async () => {
    const port = manualPort()
    const catalog = createCatalogClient(port)
    const controller = new AbortController()

    const search = catalog.search({ text: 'mos' }, controller.signal)
    port.answer({ id: 1, ok: true, value: [] })
    await search

    // Aborting afterwards must not post an abandon for a request that already answered.
    controller.abort()
    expect(port.requests.filter(isAbandon)).toEqual([])
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
