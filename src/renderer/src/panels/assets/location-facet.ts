import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_BADGES, type AssetBadge } from '@shared/domain/asset'
import type { FacetDescriptor } from '@/helpers/collection-state'

export const LOCATION_FACET = 'location'

/**
 * The states worth narrowing to, out of the seven a badge can show.
 *
 * `to-pull`, `conflict` and `other-account` are left out on purpose: none of them can be
 * reached while pushing and pulling stay explicit, so offering them would be four filters that
 * always answer nothing. They come back with the policy that produces them.
 */
const FILTERABLE: readonly AssetBadge[] = ['local-only', 'synced', 'to-push', 'error']

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
