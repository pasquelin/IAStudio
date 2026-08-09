import type { AssetType } from '@shared/domain/asset'
import type { UploadKind } from '@shared/domain/asset-mime'

/**
 * The filter `POST /search/assets` takes, in its Meilisearch-style syntax.
 *
 * Search is the only way to narrow one's OWN assets by tag — `GET /assets?tags=` is documented
 * as honouring tags for public assets only — so this expression is what makes the tag facet
 * work at all.
 *
 * `filterExpression` below stays on `kind` alone. `metadata.type` IS filterable — measured
 * against the API on 9 August 2026, see `publicFeedFilter` — but only the public index was
 * measurable: this account holds no private asset, so nothing proves the same of one's own. The
 * private path is left exactly as it was rather than changed on an untested assumption.
 */

/**
 * The API's media classes, from our six. Several of ours share one.
 *
 * Typed against the same union the upload table uses rather than `string`: a typo here compiles
 * and produces a filter that silently matches nothing, which is the one failure mode a filter
 * expression cannot signal.
 */
const KIND_BY_TYPE: Record<AssetType, UploadKind> = {
  image: 'image',
  texture: 'image',
  skybox: 'image',
  video: 'video',
  audio: 'audio',
  mesh: '3d',
}

/**
 * A value inside double quotes. Backslashes first, or escaping the quotes would then have their
 * own backslashes escaped in turn.
 */
function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export type FilterTerms = {
  tags?: readonly string[]
  types?: readonly AssetType[]
  collectionId?: string
}

/**
 * The expression, or `undefined` when nothing narrows anything — an empty filter and no filter
 * mean the same thing to the API, and sending `""` risks a 400 for nothing.
 *
 * Tags are joined with AND: filters narrow, they do not widen. Kinds are joined with OR inside
 * their own group, because asking for pictures and takes means either, not both at once.
 */
export function filterExpression({ tags, types, collectionId }: FilterTerms): string | undefined {
  const clauses: string[] = []

  for (const tag of tags ?? []) clauses.push(`tags = ${quoted(tag)}`)

  const kinds = [...new Set((types ?? []).map(type => KIND_BY_TYPE[type]))]
  if (kinds.length > 0) {
    const group = kinds.map(kind => `kind = ${quoted(kind)}`).join(' OR ')
    clauses.push(kinds.length === 1 ? group : `(${group})`)
  }

  if (collectionId !== undefined) clauses.push(`collectionIds = ${quoted(collectionId)}`)

  return clauses.length > 0 ? clauses.join(' AND ') : undefined
}

/**
 * What the API flagged, left out. An array it omits on everything it cleared, so emptiness is
 * the test — not a comparison against a value that is never there.
 */
export const NSFW_EMPTY = 'nsfw IS EMPTY'

/**
 * `CONTAINS` and not a prefix: a texture arrives as `texture`, `upscale-texture` or
 * `inference-txt2img-texture`, and a sky as `skybox-base-360` or `upscale-skybox`. `ENDS WITH`
 * would say it exactly, and the API answers 500 to it — measured, not assumed.
 */
function contains(needle: string): string {
  return `metadata.type CONTAINS ${quoted(needle)}`
}

/**
 * What the explore feed asks for: one kind of published asset, minus anything flagged.
 *
 * Deliberately WIDER than `assetTypeOfRemote`, which decides the same question exactly. This one
 * only has to avoid asking for a page the caller will then empty: the hits are typed again on
 * arrival, so an over-catch costs a shorter page and an under-catch would lose assets for good.
 */
export function publicFeedFilter(type: AssetType): string {
  const clauses = [NSFW_EMPTY]

  if (type === 'texture' || type === 'skybox') clauses.push(contains(type))
  else {
    clauses.push(`kind = ${quoted(KIND_BY_TYPE[type])}`)
    // Both share `kind: image`, and a feed of pictures that opens on seven channels of one
    // material is not the feed anyone asked for.
    if (type === 'image') clauses.push(`NOT ${contains('texture')}`, `NOT ${contains('skybox')}`)
  }

  return clauses.join(' AND ')
}

/**
 * How the feed is ordered. `score:desc` reads as the obvious choice and the documentation lists
 * `score` among the sortable fields; the API refuses it outright — `400 Invalid sort field`,
 * measured 9 August 2026. Newest first is the honest fallback.
 */
export const PUBLIC_FEED_SORT: readonly string[] = ['createdAt:desc']
