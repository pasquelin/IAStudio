import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_BADGES, type AssetBadge } from '@shared/domain/asset'

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
