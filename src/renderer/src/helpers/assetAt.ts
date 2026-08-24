import { chunk } from '@shared/collections'
import { ASSET_PATHS_MAX, type Asset } from '@shared/domain/asset'
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
  const found = await getBridge()
    ?.assets.search({ path, limit: 1 })
    .catch(() => [])

  return found?.[0] ?? null
}

/**
 * The same question for a whole listing, keyed by path — one round trip per `ASSET_PATHS_MAX`.
 *
 * A panel showing four hundred files asked four hundred times, and each answer is a query
 * against the project's own database, in the process that owns every window. `limit` is the
 * number of paths asked about: a path names at most one row, and leaving the catalogue's own
 * default in place would have cut the answer where the question was already bounded.
 *
 * Cut into batches rather than sent whole, and that bound is not decoration: the main process
 * REFUSES a longer list, and `assetsAt` swallows a refusal — a project of three thousand files
 * lost every catalogue answer at once, falling back to guessing from extensions with nothing
 * on screen to say so.
 *
 * Answers an empty map rather than throwing, for the reason `assetAt` answers `null`.
 */
export async function assetsAt(paths: readonly string[]): Promise<Map<string, Asset>> {
  if (paths.length === 0) return new Map()

  const answers = await Promise.all(
    chunk(paths, ASSET_PATHS_MAX).map(
      async batch =>
        (await getBridge()
          ?.assets.search({ paths: batch, limit: batch.length })
          .catch(() => [])) ?? [],
    ),
  )

  return new Map(answers.flat().flatMap(asset => (asset.path ? [[asset.path, asset]] : [])))
}
