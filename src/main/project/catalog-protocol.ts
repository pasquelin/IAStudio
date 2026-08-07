import type { Asset, AssetQuery } from '@shared/domain/asset'

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
  | { id: number; op: 'findByRemoteId'; remoteAssetId: string }
  | { id: number; op: 'search'; query: AssetQuery }

/** What each operation answers, so the client can type its promise without a cast. */
export type CatalogResults = {
  add: Asset
  find: Asset | null
  findByRemoteId: Asset | null
  search: Asset[]
}

export type CatalogOp = CatalogRequest['op']

export type CatalogResponse =
  | { id: number; ok: true; value: CatalogResults[CatalogOp] }
  | { id: number; ok: false; error: string }

/** The worker's first message: the database is open, or it never will be. */
export type CatalogReady = { ready: true } | { ready: false; error: string }

export function isCatalogReady(value: unknown): value is CatalogReady {
  return typeof value === 'object' && value !== null && 'ready' in value
}
