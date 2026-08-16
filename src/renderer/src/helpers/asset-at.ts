import type { Asset } from '@shared/domain/asset'
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
