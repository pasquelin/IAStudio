import { useTranslation } from 'react-i18next'
import type { AssetType } from '@shared/domain/asset'
import { chipSkin } from '@/design/styles'
import { HINT_BOTTOM } from '@/helpers/tooltip'

export function ExploreTab({
  type,
  current,
  onSelect,
}: {
  type: AssetType
  current: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      role="tab"
      aria-selected={current}
      {...HINT_BOTTOM(t('home.exploreTabHint'))}
      onClick={onSelect}
      className={chipSkin(current)}
    >
      {t(`assetTypes.${type}`)}
    </button>
  )
}
