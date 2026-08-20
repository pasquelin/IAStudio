import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import { Thumbnail } from '@/design/Thumbnail'
import { Row } from '@/design/Row'

/** The chosen model, kept in view: it is what the generator below will run. */
export function ModelsSelected({
  model,
  picture,
}: {
  model: ModelSummary | null
  picture?: string
}) {
  const { t } = useTranslation()

  // Height stated rather than grown into: `Row` sizes itself against its parent, and 56 px is
  // what this header measured when it was written by hand. The bottom border eats a pixel of it.
  return (
    <div className="border-border h-14 border-b px-1 py-1.5">
      <Row
        media={<Thumbnail url={picture} className="size-10" />}
        title={model?.name ?? t('models.noSelection')}
        subtitle={model ? t(`families.${model.family}`) : t('models.pickOne')}
      />
    </div>
  )
}
