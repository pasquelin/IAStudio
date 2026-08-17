import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import type { FacetDescriptor } from '@/helpers/collectionState'
import { TYPE_FACET } from '@/panels/assets/facets'

export function useTypeFacet(labels: Map<AssetType, string>): FacetDescriptor[] {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        key: TYPE_FACET,
        label: t('assets.type'),
        options: ASSET_TYPES.map(value => ({ value, label: labels.get(value) ?? value })),
      },
    ],
    [t, labels],
  )
}
