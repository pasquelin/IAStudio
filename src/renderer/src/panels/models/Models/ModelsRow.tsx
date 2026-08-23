import type { TFunction } from 'i18next'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import { Thumbnail } from '@/design/Thumbnail'
import { Row } from '@/design/Row'

/**
 * Standing plus a line. Rating, generation time and category come back empty on all 642 public
 * models — measured. A catalogue description replaces origin; "featured" still prefixes it.
 */
function subtitleOf(model: ModelSummary, t: TFunction): string {
  if (model.description) {
    if (!model.featured) return model.description
    return `${t('models.featured')} · ${model.description}`
  }

  let standing: string
  if (model.featured) standing = t('models.featured')
  else if (model.origin === 'official') standing = t('models.official')
  else standing = t('models.community')

  const [capability] = model.capabilities
  // An unknown capability shows its API name rather than its missing translation key.
  if (!capability) return standing
  return `${standing} · ${t(`capabilities.${capability}`, { defaultValue: capability })}`
}

/** Memoized like the card: a scroll re-renders every mounted row on each frame. */
export const ModelsRow = memo(function ModelsRow({
  model,
  picture,
  refusal,
}: {
  model: ModelSummary
  picture?: string
  refusal?: ModelRefusalWord
}) {
  const { t } = useTranslation()

  return (
    <Row
      media={<Thumbnail url={picture} className="size-8" />}
      title={model.name}
      // The subtitle says what the model IS; the refusal says why it is out of reach, and it
      // replaces the standing rather than crowding a 10px line with both.
      subtitle={refusal ? refusal.word : subtitleOf(model, t)}
      hint={refusal?.hint}
    />
  )
})
