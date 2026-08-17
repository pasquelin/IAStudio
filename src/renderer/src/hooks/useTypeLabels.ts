import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'

/**
 * Six constant strings, resolved once for the whole panel. A row is remounted by the hundred
 * while scrolling, so translating inside one would run i18next per row and per frame.
 */
export function useTypeLabels(): Map<AssetType, string> {
  const { t } = useTranslation()

  return useMemo(() => new Map(ASSET_TYPES.map(value => [value, t(`assetTypes.${value}`)])), [t])
}
