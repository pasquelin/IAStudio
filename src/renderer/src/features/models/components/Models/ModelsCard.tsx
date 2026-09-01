import type { TFunction } from 'i18next'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import { HINT_LEFT } from '@/helpers/tooltip'
import { cn } from '@/helpers/cn'
import { MediaTile } from '@/components/MediaTile'
import { TILE_MARK } from '@/components/styles'

/**
 * The tile's corner label: a standing, or the reason the model cannot be picked. On the plate
 * every other mark sits on — `px-1` over its own padding, this one carrying words rather than a
 * glyph.
 */
const BADGE = cn(
  TILE_MARK,
  'text-text absolute top-1 right-1 max-w-[calc(100%-0.5rem)]',
  'truncate px-1 text-micro leading-tight',
)

/**
 * The tile's corner label. The refusal outranks "featured": a highlighted model the plan will
 * not run is first of all one that cannot be picked, and the tile has room for one label.
 */
function badgeFor(
  model: ModelSummary,
  refusal: ModelRefusalWord | undefined,
  t: TFunction,
): ReactNode {
  // Left, not right: the badge already sits against the tile's right edge, and this panel is
  // docked to a side — a tooltip opening outward would leave the window. HINT and not TIP:
  // the badge's own words are on screen, so this explains them instead of repeating them.
  if (refusal) {
    return (
      <span {...HINT_LEFT(refusal.hint)} className={BADGE}>
        {refusal.word}
      </span>
    )
  }

  if (!model.featured) return null

  return (
    <span title={t('models.featured')} className={BADGE}>
      {t('models.featured')}
    </span>
  )
}

export const ModelsCard = memo(function ModelsCard({
  model,
  picture,
  refusal,
}: {
  model: ModelSummary
  picture?: string
  refusal?: ModelRefusalWord
}) {
  const { t } = useTranslation()

  return <MediaTile url={picture} caption={model.name} badge={badgeFor(model, refusal, t)} />
})
