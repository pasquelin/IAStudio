import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_BADGES, type AssetBadge } from '@shared/domain/asset'
import type { FacetDescriptor } from '@/helpers/collection-state'

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
const FILTERABLE: readonly AssetBadge[] = [
  'local-only',
  'synced',
  'to-push',
  'to-pull',
  'conflict',
  'error',
  'remote-only',
  'generating',
]

/**
 * Narrowing by what the badge says, rather than by a field of its own.
 *
 * The same function decides both — `assetBadgeOf` — so what the filter offers is exactly what
 * the tiles show. A facet reading `location` straight off the row would disagree with the mark
 * beside it the moment a sync state was involved.
 */
export function useLocationFacet(): FacetDescriptor[] {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        key: LOCATION_FACET,
        label: t('assets.location'),
        options: FILTERABLE.map(value => ({ value, label: t(`assets.badge.${value}`) })),
      },
    ],
    [t],
  )
}

/**
 * The seven badge labels, resolved once for the whole panel.
 *
 * Same reason as `useTypeLabels`: a tile is remounted by the hundred while scrolling, and a
 * `useTranslation` inside the badge would run i18next per tile and per frame — and subscribe
 * each one of them separately. The Map's identity is stable, so `memo` still holds.
 */
export function useBadgeLabels(): Map<AssetBadge, string> {
  const { t } = useTranslation()

  return useMemo(() => new Map(ASSET_BADGES.map(badge => [badge, t(`assets.badge.${badge}`)])), [t])
}
