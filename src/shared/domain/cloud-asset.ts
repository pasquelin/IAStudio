import type { AssetGeneration, AssetType } from './asset'

/** What the API says an asset may be seen by. No documented endpoint changes it. */
export type AssetPrivacy = 'private' | 'public' | 'unlisted'

/**
 * An asset that lives in the library and not in the project.
 *
 * A type of its own rather than a half-filled `Asset`: this one has no path, no hash and no
 * probe, and every reader that took it for a local asset would have to guard against all three.
 * It becomes an `Asset` the day it is pulled, and not before.
 *
 * It is also the meeting point of two API response schemas that do not match — `GET /assets`
 * and `POST /search/assets` — which is why nothing here is optional out of laziness: each
 * optional field is one that a search hit genuinely does not carry.
 */
export type CloudAsset = {
  id: string
  name: string
  /** Our own six-value projection of the eighty the API sorts by. */
  type: AssetType
  /** `metadata.type`, verbatim — what the API filters on, and what we filter back through. */
  remoteType: string
  ownerId: string
  createdAt: string
  updatedAt: string
  privacy: AssetPrivacy
  tags: string[]
  collectionIds: string[]
  /**
   * The asset itself, signed and expiring — between 24 hours and about two weeks.
   *
   * Never persisted, never used as a cache key, never an identifier. What is kept is the id,
   * and the URL is asked for again when it is needed.
   */
  url?: string
  /** Served from `/thumbnails/*`, which is public, unsigned and stable. */
  thumbnailUrl?: string
  width?: number
  height?: number
  bytes?: number
  /**
   * Seconds, as `properties.duration` reports them — and named so, because the rest of the
   * studio counts in microseconds. Converting here would be guessing at a unit the local probe
   * will state for certain the moment the asset is pulled; a browser only needs to print it.
   */
  durationSeconds?: number
  generation?: AssetGeneration
}

/** How large a preview should come down. The CDN resizes; downloading a 4K to draw 112 px does not. */
export type PreviewSize = { width?: number; quality?: number }

/**
 * The picture that stands for a cloud asset, or `null` when it has none to show.
 *
 * Transformations are applied to the thumbnail alone, and that restriction is the whole point:
 * the asset's own URL carries `Policy`, `Signature` and `Key-Pair-Id`, and appending anything
 * to it invalidates the signature — the CDN answers 403 for a query string we added ourselves.
 * The thumbnail is public, so it can be resized freely.
 */
export function cloudPreviewUrl(asset: CloudAsset, size: PreviewSize = {}): string | null {
  if (asset.thumbnailUrl === undefined) return asset.url ?? null

  const params = new URLSearchParams()
  if (size.width !== undefined) params.set('width', String(size.width))
  if (size.quality !== undefined) params.set('quality', String(size.quality))

  const query = params.toString()
  if (query === '') return asset.thumbnailUrl

  return `${asset.thumbnailUrl}${asset.thumbnailUrl.includes('?') ? '&' : '?'}${query}`
}
