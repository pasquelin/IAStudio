import type { AssetType } from '@shared/domain/asset'

/**
 * The filter `POST /search/assets` takes, in its Meilisearch-style syntax.
 *
 * Search is the only way to narrow one's OWN assets by tag — `GET /assets?tags=` is documented
 * as honouring tags for public assets only — so this expression is what makes the tag facet
 * work at all.
 *
 * Note what is NOT here: `metadata.type`. The search index exposes `kind` and not the eighty
 * provenance values, so a search can ask for pictures but not for skies. That is why the plain
 * listing, which does filter on `types`, stays the path taken whenever tags are not involved.
 */

/** The API's eight media classes, from our six. Several of ours share one. */
const KIND_BY_TYPE: Record<AssetType, string> = {
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
  if (kinds.length === 1) clauses.push(`kind = ${quoted(kinds[0] ?? '')}`)
  if (kinds.length > 1)
    clauses.push(`(${kinds.map(kind => `kind = ${quoted(kind)}`).join(' OR ')})`)

  if (collectionId !== undefined) clauses.push(`collectionIds = ${quoted(collectionId)}`)

  return clauses.length > 0 ? clauses.join(' AND ') : undefined
}
