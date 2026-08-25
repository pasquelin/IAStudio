import { useMemo } from 'react'
import type { AssetType } from '@shared/domain/asset'
import type { FacetDescriptor } from '@/helpers/collectionState'
import { useSourceFacet } from './useSourceFacet'
import { useTypeFacet } from './useTypeFacet'

/**
 * Every facet the shelf offers, in one place.
 *
 * The browser and its header render two different bars over the SAME collection state — one
 * lying in a band, one in a column. Composing the list twice let them drift, and a facet the
 * header offered but the shelf did not would narrow a list nothing could widen again.
 */
export function useAssetFacets(typeLabels: Map<AssetType, string>): FacetDescriptor[] {
  const typeFacet = useTypeFacet(typeLabels)
  const sourceFacet = useSourceFacet()

  return useMemo(() => [...typeFacet, ...sourceFacet], [typeFacet, sourceFacet])
}
