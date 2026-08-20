import { describe, expect, it } from 'vitest'
import {
  isCatalogReady,
  isQueueMessage,
  isRescanResponse,
  type CatalogMessage,
  type CatalogResponse,
} from './catalogProtocol'
import type { RescanReport } from './catalogRescan'

const REPORT: RescanReport = { moved: 0, missing: 0, returned: 0, complete: true }

/**
 * What this boundary must REFUSE. `catalogClient.test.ts` drives the shapes that pass — a
 * progress line followed by the answer that settles, requests and abandons through the queue —
 * so what is left uncovered is the answers a guard has to turn away.
 */
describe('telling the catalogue worker messages apart', () => {
  it('tells the answer of a rescan from the answer of a request', () => {
    const rescan: CatalogResponse = { id: 1, ok: true, rescan: REPORT }
    const value: CatalogResponse = { id: 1, ok: true, value: null }

    expect(isRescanResponse(rescan)).toBe(true)
    expect(isRescanResponse(value)).toBe(false)
  })

  it('keeps what runs beside the queue out of it', () => {
    const rescan: CatalogMessage = { id: 1, op: 'rescan', root: '/p' }
    const stop: CatalogMessage = { op: 'rescan-stop', target: 1 }

    // Neither reaches this guard in production — `catalogQueue` asks `isRescan` and
    // `isRescanStop` first — so the contract is only stated here.
    expect(isQueueMessage(rescan)).toBe(false)
    expect(isQueueMessage(stop)).toBe(false)
  })

  it('takes the first word of a worker for a verdict only when it carries one', () => {
    expect(isCatalogReady({ ready: false, error: 'locked' })).toBe(true)
    // A response, not an opening verdict: the thread sends both down the same channel.
    expect(isCatalogReady({ id: 1, ok: true, value: null })).toBe(false)
    expect(isCatalogReady(null)).toBe(false)
    expect(isCatalogReady('ready')).toBe(false)
  })
})
