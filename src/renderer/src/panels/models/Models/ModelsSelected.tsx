import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import { Thumbnail } from '@/design/Thumbnail'
import { Row } from '@/design/Row'
import { FIELD_THUMBNAIL } from '@/design/styles'

/** The chosen model, kept in view: it is what the generator below will run. */
export function ModelsSelected({
  model,
  picture,
}: {
  model: ModelSummary | null
  picture?: string
}) {
  const { t } = useTranslation()

  // Grown into rather than stated: `h-14` was this header measured by hand at one density, and
  // the picture below now carries a gauge that follows the other.
  return (
    <div className="border-border border-b px-1 py-1.5">
      <Row
        media={<Thumbnail url={picture} className={FIELD_THUMBNAIL} />}
        title={model?.name ?? t('models.noSelection')}
        subtitle={model ? t(`families.${model.family}`) : t('models.pickOne')}
      />
    </div>
  )
}
