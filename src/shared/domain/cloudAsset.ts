import type { AssetGeneration, AssetType, CloudAssetType } from './asset'

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

/**
 * How a listing comes back ordered.
 *
 * `relevance` is the index's OWN ranking, obtained by asking for no order at all: the API refuses
 * `score` as a sort field — `400 Invalid sort field`, measured 9 August 2026 — so relevance is
 * never a value it is told, only one it is not overruled on. It needs a `text` to mean anything.
 */
export type CloudOrder = 'newest' | 'relevance'

/** The values, beside the type: a validator and an action's choices both enumerate them. */
export const CLOUD_ORDERS: readonly CloudOrder[] = ['newest', 'relevance']

/**
 * What the browser asks the library for.
 *
 * `text` and `tags` are what force the search endpoint rather than the plain listing: filtering
 * one's own assets by tag is documented as impossible on `GET /assets`, which honours `tags`
 * for public assets only.
 */
export type CloudQuery = {
  text?: string
  tags?: readonly string[]
  /**
   * The kinds the API can be asked for, translated to its own eighty on the way out.
   *
   * `CloudAssetType`, so what the studio knows alone cannot be requested: there is no animation
   * class over there, and asking for one would answer a shelf of characters.
   */
  types?: readonly CloudAssetType[]
  collectionId?: string
  /** Opaque, straight from the previous page. */
  cursor?: string
  pageSize?: number
  /**
   * Defaults to `newest`, which is what the shelf needs and what every panel asks for. A caller
   * searching by words is the one that wants otherwise — an agent asking for stone textures gets
   * the most recent assets rather than the most fitting ones.
   */
  order?: CloudOrder
}

export type CloudPage = {
  assets: CloudAsset[]
  /** `null` at the end of the listing. There is no total to report — the API gives none. */
  cursor: string | null
}

/**
 * What the home's explore feed asks for.
 *
 * A query of its own rather than a flag on `CloudQuery`: it reads assets nobody here owns and
 * pages by offset alone, so sharing the type would mean fields that mean one thing in one mode
 * and another in the other.
 */
export type ExploreQuery = {
  /** One tab of the feed, and only a kind the API sorts by — it publishes no motion. */
  type: CloudAssetType
  /**
   * What to look for in the feed, or nothing to take it whole.
   *
   * The feed keeps its `createdAt:desc` order with a text as without one, and carries no `order`
   * of its own — unlike `CloudQuery`, no caller can want otherwise: the shelf merges this source
   * with two others on that stamp, and the feed is the one read the assistant cannot pass words to.
   */
  text?: string
  /** Opaque, straight from the previous page. */
  cursor?: string
  pageSize?: number
}

/**
 * The kinds whose own file IS a still picture, and can therefore be drawn as one.
 *
 * A take or a clip has a URL too, and it is the sound or the film itself — an `<img>` pointed at
 * one draws nothing. Those keep the thumbnail, which is a picture OF them rather than them.
 */
const DRAWABLE_TYPES: readonly AssetType[] = ['image', 'texture', 'skybox']

/**
 * The picture that stands for a cloud asset, or `null` when it has none to show, resized to
 * `width` pixels when one is asked for.
 *
 * The asset's own URL wins for the kinds that are a picture, because it is the one carrying the
 * pixels: it points at `/assets-transform/`, which resizes on demand. The thumbnail is a small
 * fixed rendition, and a tile drawn from it is soft the moment the tile is larger than it.
 *
 * Appending to that URL is safe, which this file long claimed it was not. Measured on
 * 16 August 2026: the signed policy names `…?p=100*` — a WILDCARD, so anything added after
 * `p=100` falls inside the signature. Added BEFORE it would fall outside; the order is what a
 * 403 would depend on, not the presence of a parameter.
 *
 * `width` alone, and the two parameters that used to sit beside it are gone on the same
 * measurement: `quality` changes nothing on a PNG (40 and 80 answered the same 131 526 bytes),
 * and `format=jpeg` drops the alpha channel to save 2 ko over WebP.
 */
export function cloudPreviewUrl(asset: CloudAsset, width?: number): string | null {
  const drawable = DRAWABLE_TYPES.includes(asset.type)
  const baseUrl = drawable ? (asset.url ?? asset.thumbnailUrl) : (asset.thumbnailUrl ?? asset.url)

  if (baseUrl === undefined) return null
  if (width === undefined) return baseUrl

  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}width=${width}`
}
