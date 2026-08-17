import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FacetDescriptor } from '@/helpers/collectionState'
import { FILTERABLE_BADGES, LOCATION_FACET } from '@/panels/assets/facets'

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
        options: FILTERABLE_BADGES.map(value => ({ value, label: t(`assets.badge.${value}`) })),
      },
    ],
    [t],
  )
}
