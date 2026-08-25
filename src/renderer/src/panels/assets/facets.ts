/**
 * What the remote browser narrows by. The hooks that turn these into descriptors live under
 * `hooks/` — `useAssetFacets`, `useTypeFacet`, `useSourceFacet`.
 */
export const TYPE_FACET = 'type'

/**
 * Which library a line comes from.
 *
 * 🛑 It replaces the Emplacement facet, whose nine values were sync states — `local-only`,
 * `to-push`, `error` — every one of them about a row this panel no longer draws. It is also the
 * one facet that changes what is READ rather than what is drawn: the public feed is unbounded
 * and a page of it costs a search quota, so it is asked for only while it is chosen.
 *
 * Two values today because one cloud publishes assets. `CLOUD_PROVIDERS` is where a second would
 * declare itself, and this is the facet it would extend — a value, not a branch.
 */
export const SOURCE_FACET = 'source'

/** The account's own library: what its key opens onto. The default, and what `browse` reads. */
export const OWN_SOURCE = 'mine'

/** What everyone else published, which is what `explore` reads. */
export const PUBLISHED_SOURCE = 'published'

export const SOURCES: readonly string[] = [OWN_SOURCE, PUBLISHED_SOURCE]
