import type { AssetBadge } from '@shared/domain/asset'

/**
 * What the shelf narrows by. The hooks that turn these into descriptors live under `hooks/` —
 * `useAssetFacets`, `useTypeFacet`, `useLocationFacet`.
 */
export const TYPE_FACET = 'type'

export const LOCATION_FACET = 'location'

/**
 * The states worth narrowing to, out of every mark a badge can show.
 *
 * `to-pull` and `conflict` joined the list when the browser started reading a page of the
 * library beside the catalogue: they are what comparing the two stamps produces, and until
 * something did that comparison they were filters that always answered nothing.
 *
 * Three stay out, each for its own reason. `other-account` cannot be reached while the panel
 * only ever lists one key's own library. `fetching` lasts under a second — a filter on it would
 * answer nothing by the time the pointer arrived. And `missing` is not a place an asset is: a
 * row that lost its file is either handed back to the library or forgotten, so narrowing to it
 * would offer a shelf of things about to disappear.
 */
export const FILTERABLE_BADGES: readonly AssetBadge[] = [
  'local-only',
  'synced',
  'to-push',
  'to-pull',
  'conflict',
  'error',
  'remote-only',
  'generating',
]
