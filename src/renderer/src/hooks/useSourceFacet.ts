import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FacetDescriptor } from '@/helpers/collectionState'
import { SOURCE_FACET, SOURCES } from '@/panels/assets/facets'

/**
 * Narrowing by which library a line comes from.
 *
 * Nothing chosen reads the account's own, which is what someone opening the panel is looking
 * for. Ticking the feed ADDS to it rather than replacing it: the two are one timeline, and an
 * asset one owns and has also published shows once, as one's own.
 */
export function useSourceFacet(): FacetDescriptor[] {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        key: SOURCE_FACET,
        label: t('assets.source'),
        options: SOURCES.map(value => ({ value, label: t(`assets.sourceName.${value}`) })),
      },
    ],
    [t],
  )
}
