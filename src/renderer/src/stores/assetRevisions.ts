import type { Asset } from '@shared/domain/asset'

/**
 * When the main process last wrote each asset, straight from the event that said so.
 *
 * A registry of its own rather than a write into the shelf's index, which is DERIVED from `items`
 * and says so: a second writer there would be overwritten by the next page read, notify nobody,
 * and hand every `assetsById` subscriber a changed identity for a value it cannot see.
 *
 * What it lifts is a ceiling. `items` is one page of the newest rows, so an asset older than that
 * page kept the stamp it was last SEEN with, and every texture slot pointing at it compared equal
 * for ever. A row that lands here is fresher than any page, whatever the shelf is showing.
 */
const written = new Map<string, string>()

/** Rows the main process just wrote. O(k) and reference-stable — nothing derives from this map. */
export function rememberAssetRevisions(changed: readonly Asset[]): void {
  for (const asset of changed) {
    if (asset.localChangedAt) written.set(asset.id, asset.localChangedAt)
  }
}

/** What the event last said, or nothing when no event has named this asset. */
export function assetRevisionOf(assetId: string): string | undefined {
  return written.get(assetId)
}

/**
 * Drops every revision — the project being left. Called beside `forgetRememberedAssets`, and by
 * the test harness for the same reason: this map lives at module scope.
 */
export function forgetAssetRevisions(): void {
  written.clear()
}
