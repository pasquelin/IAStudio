import type { ActivityDraft, ActivityEntry, ActivityQuery } from '@shared/domain/activity'
import type { Asset, AssetCounts, AssetQuery } from '@shared/domain/asset'
import {
  ABANDONED,
  type CatalogMessage,
  type CatalogRequest,
  type CatalogResponse,
  type CatalogResults,
} from './catalog-protocol'

/**
 * The thread, reduced to what the client needs. Injected rather than imported so the protocol
 * can be tested against a real catalogue without spawning anything.
 */
export type CatalogPort = {
  postMessage: (message: CatalogMessage) => void
  onMessage: (listener: (response: CatalogResponse) => void) => void
  /** The thread died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
  terminate: () => Promise<void>
}

/**
 * The catalogue as the main process sees it now: the same three operations, each a promise.
 *
 * Asynchronous is the whole point — `better-sqlite3` blocks the thread it runs on, and a
 * hundred-thousand-asset search measured 15 to 44 ms on the main thread, which is every window
 * frozen for that long (CLAUDE.md, invariant 6).
 */
export type AsyncCatalog = {
  add: (asset: Asset) => Promise<Asset>
  find: (assetId: string) => Promise<Asset | null>
  findByHash: (hash: string) => Promise<Asset | null>
  /** The local row a generated asset landed in, looked up by its Scenario identifier. */
  findByRemoteId: (remoteAssetId: string) => Promise<Asset | null>
  /**
   * The signal is what an abandoned search costs nothing: the thread skips the ones it has not
   * begun, and this side stops waiting for the one it may already be running. Rejects with
   * `ABANDONED`, which a caller must tell from a failure — it is not an empty result.
   */
  search: (query: AssetQuery, signal?: AbortSignal) => Promise<Asset[]>
  /** The six totals, counted in SQL — the home asks for them, never for the rows behind them. */
  countByType: () => Promise<AssetCounts>
  remove: (assetId: string) => Promise<void>
  /** Refiles the row at `from`, and everything beneath it, under `to`. Ids do not change. */
  repath: (from: string, to: string) => Promise<void>
  /**
   * Drops the row at `path` and every row beneath it — a folder the user sent to the trash.
   * Answers how many rows went, so a caller knows whether anything is worth telling a window.
   */
  forgetUnder: (path: string) => Promise<number>
  /** Writes a batch of journal lines and answers them with the ids the database gave them. */
  appendActivity: (entries: readonly ActivityDraft[]) => Promise<ActivityEntry[]>
  readActivity: (query: ActivityQuery) => Promise<ActivityEntry[]>
  close: () => Promise<void>
}

type Pending = {
  resolve: (value: CatalogResults[CatalogRequest['op']]) => void
  reject: (error: Error) => void
  /** Drops the abort listener: a signal outlives the search it was handed to. */
  release: () => void
}

export function createCatalogClient(port: CatalogPort): AsyncCatalog {
  const pending = new Map<number, Pending>()
  let nextId = 1
  let closed = false

  /** Named once: the close and the death of the thread are the same news to a caller. */
  const CLOSED = 'catalogue is closed'

  /** Rejects everything still waiting. A dead thread answers nothing, ever. */
  const abandon = (reason: string): void => {
    const waiting = [...pending.values()]
    pending.clear()
    for (const slot of waiting) {
      slot.release()
      slot.reject(new Error(reason))
    }
  }

  port.onMessage(response => {
    const slot = pending.get(response.id)
    // An answer to a request already settled — by a close, or by a duplicate — is not an error.
    if (!slot) return
    pending.delete(response.id)
    slot.release()

    if (response.ok) slot.resolve(response.value)
    else slot.reject(new Error(response.error))
  })

  port.onFailure(error => {
    closed = true
    abandon(`catalogue thread failed: ${error.message}`)
  })

  const send = <Op extends CatalogRequest['op']>(
    build: (id: number) => Extract<CatalogRequest, { op: Op }>,
    signal?: AbortSignal,
  ): Promise<CatalogResults[Op]> =>
    new Promise((resolve, reject) => {
      if (closed) {
        reject(new Error(CLOSED))
        return
      }

      // Nothing is sent for a search already given up on before it left.
      if (signal?.aborted) {
        reject(new Error(ABANDONED))
        return
      }

      const id = nextId++

      // Sent before anything is recorded, the order `bvh-inflight` settled on: a port whose
      // thread is gone throws here, and everything below would then be left behind — the entry
      // AND the abort listener on someone else's signal, with the promise never settling. The
      // throw rejects this promise on its own, which is the answer the caller needs.
      //
      // Safe in this order because a port cannot answer during `postMessage`: its message event
      // is always a turn later.
      port.postMessage(build(id))

      // Reachable only while the request is still waiting: `release` drops this listener on both
      // paths that settle one, which is what makes the state a guard here would defend against
      // impossible. Two tests hold that, one per path.
      const abort = (): void => {
        pending.delete(id)
        // The port may have gone since; the caller hears the search was abandoned either way,
        // and a throw from inside an `abort` listener would surface nowhere useful.
        try {
          port.postMessage({ op: 'abandon', target: id })
        } catch {
          closed = true
        }
        reject(new Error(ABANDONED))
      }
      signal?.addEventListener('abort', abort, { once: true })

      // The response type follows the request's `op`, which the union already guarantees; the
      // map cannot carry that link, so the narrowing happens here once rather than per caller.
      pending.set(id, {
        resolve: value => resolve(value as CatalogResults[Op]),
        reject,
        release: () => signal?.removeEventListener('abort', abort),
      })
    })

  return {
    add: asset => send<'add'>(id => ({ id, op: 'add', asset })),

    find: assetId => send<'find'>(id => ({ id, op: 'find', assetId })),

    findByHash: hash => send<'findByHash'>(id => ({ id, op: 'findByHash', hash })),
    findByRemoteId: remoteAssetId =>
      send<'findByRemoteId'>(id => ({ id, op: 'findByRemoteId', remoteAssetId })),

    search: (query, signal) => send<'search'>(id => ({ id, op: 'search', query }), signal),

    countByType: () => send<'countByType'>(id => ({ id, op: 'countByType' })),

    remove: assetId => send<'remove'>(id => ({ id, op: 'remove', assetId })),

    repath: (from, to) => send<'repath'>(id => ({ id, op: 'repath', from, to })),
    forgetUnder: path => send<'forgetUnder'>(id => ({ id, op: 'forgetUnder', path })),

    appendActivity: entries =>
      send<'appendActivity'>(id => ({ id, op: 'appendActivity', entries })),
    readActivity: query => send<'readActivity'>(id => ({ id, op: 'readActivity', query })),

    close: async () => {
      closed = true
      // Whoever is still waiting is waiting on a thread that is about to stop answering.
      abandon(CLOSED)
      await port.terminate()
    },
  }
}
