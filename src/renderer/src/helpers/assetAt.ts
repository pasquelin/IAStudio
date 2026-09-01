import { orElse } from '@shared/promises'
import { chunk } from '@shared/collections'
import { ASSET_SEARCH_LIMIT_MAX, type Asset, type AssetQuery } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'

/**
 * Which asset sits at this path, or `null` — the question a panel showing FILES has to ask.
 *
 * The explorer walks a folder and holds paths; every gesture that acts on an asset needs its id.
 * Two panels were asking it with the same three lines, and the shape of the question — an exact
 * `path`, `limit: 1`, take the first — is a detail of the catalogue that has no business being
 * spelled out in a panel.
 *
 * Answers `null` rather than throwing, including when the catalogue cannot answer at all: a
 * project being switched has none, and a rejection would take its caller's fallback with it.
 * What to do with `null` is the caller's own — open the file in the system, or say so.
 */
export async function assetAt(path: string): Promise<Asset | null> {
  const found = await orElse(getBridge()?.assets.search({ path, limit: 1 }), [])

  return found[0] ?? null
}

/**
 * The same question for a whole listing, keyed by path — one round trip per batch rather than one
 * per row: a panel showing four hundred files asked four hundred times, and each answer is a
 * query against the project's own database, in the process that owns every window.
 */
export async function assetsAt(paths: readonly string[]): Promise<Map<string, Asset>> {
  if (paths.length === 0) return new Map()

  const found = await batched(paths, batch => ({ paths: batch }))

  return new Map(found.flatMap(asset => (asset.path ? [[asset.path, asset]] : [])))
}

/** Which of THESE library assets the project holds, keyed by the library's own id. */
export async function assetsByRemoteId(
  remoteAssetIds: readonly string[],
): Promise<Map<string, Asset>> {
  const found = await batched(remoteAssetIds, batch => ({ remoteAssetIds: batch }))

  return new Map(
    found.flatMap(asset => (asset.remoteAssetId ? [[asset.remoteAssetId, asset]] : [])),
  )
}

/**
 * One question over a list too long to ask in one go.
 *
 * 🛑 Cut on `ASSET_SEARCH_LIMIT_MAX` and not on `ASSET_PATHS_MAX`, which bounds the list alone:
 * `limit` is the batch's own length, and the main process REFUSES a larger one rather than
 * trimming it. Cut at two thousand, a listing past five hundred lost every answer at once —
 * `orElse` swallows the refusal, so the caller reads « the catalogue holds none of these ».
 */
async function batched(
  values: readonly string[],
  ask: (batch: readonly string[]) => AssetQuery,
): Promise<Asset[]> {
  const answers = await Promise.all(
    chunk(values, ASSET_SEARCH_LIMIT_MAX).map(
      async batch =>
        await orElse(getBridge()?.assets.search({ ...ask(batch), limit: batch.length }), []),
    ),
  )

  return answers.flat()
}
