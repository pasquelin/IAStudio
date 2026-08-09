import type { ActivityDraft, ActivityEntry, ActivityQuery } from '@shared/domain/activity'
import type { Asset, AssetCounts, AssetQuery } from '@shared/domain/asset'

/**
 * What the main process and the catalogue worker say to each other.
 *
 * The catalogue itself is untouched and synchronous — it simply runs on the other side of this
 * protocol now, because `better-sqlite3` blocks the thread it runs on and the main thread owns
 * every window (CLAUDE.md, invariant 6).
 */

export type CatalogRequest =
  | { id: number; op: 'add'; asset: Asset }
  | { id: number; op: 'find'; assetId: string }
  | { id: number; op: 'findByHash'; hash: string }
  | { id: number; op: 'findByRemoteId'; remoteAssetId: string }
  | { id: number; op: 'search'; query: AssetQuery }
  | { id: number; op: 'countByType' }
  | { id: number; op: 'remove'; assetId: string }
  | { id: number; op: 'appendActivity'; entries: readonly ActivityDraft[] }
  | { id: number; op: 'readActivity'; query: ActivityQuery }

/** What each operation answers, so the client can type its promise without a cast. */
export type CatalogResults = {
  add: Asset
  find: Asset | null
  findByHash: Asset | null
  findByRemoteId: Asset | null
  search: Asset[]
  countByType: AssetCounts
  remove: void
  appendActivity: ActivityEntry[]
  readActivity: ActivityEntry[]
}

export type CatalogOp = CatalogRequest['op']

/**
 * Not a request: it answers nothing, and the id it names is one already sent.
 *
 * A `better-sqlite3` query cannot be interrupted once it has begun — what this buys is the ones
 * that have NOT begun. Six keystrokes queue six searches behind one that is running; five of
 * them describe a word nobody is looking for any more by the time their turn comes.
 */
export type CatalogAbandon = { op: 'abandon'; target: number }

/** Everything the thread receives. */
export type CatalogMessage = CatalogRequest | CatalogAbandon

export function isAbandon(message: CatalogMessage): message is CatalogAbandon {
  return message.op === 'abandon'
}

/** What an abandoned request rejects with, so a caller can tell it from a failure. */
export const ABANDONED = 'abandoned'

export type CatalogResponse =
  | { id: number; ok: true; value: CatalogResults[CatalogOp] }
  | { id: number; ok: false; error: string }

/** The worker's first message: the database is open, or it never will be. */
export type CatalogReady = { ready: true } | { ready: false; error: string }

export function isCatalogReady(value: unknown): value is CatalogReady {
  return typeof value === 'object' && value !== null && 'ready' in value
}
