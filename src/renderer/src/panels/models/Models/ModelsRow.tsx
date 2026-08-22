import type { TFunction } from 'i18next'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import { Thumbnail } from '@/design/Thumbnail'
import { Row } from '@/design/Row'

/**
 * What the API actually says about a model, in one line: who published it and what it does.
 * Rating, generation time and category come back empty on all 642 public models — measured.
 *
 * "Featured" outranks the origin: a third-party model Scenario highlights reads as vetted,
 * whereas calling GPT Image 2 "community" says the opposite of what the tag means.
 */
function subtitleOf(model: ModelSummary, t: TFunction): string {
  const standing = model.featured
    ? t('models.featured')
    : t(model.origin === 'official' ? 'models.official' : 'models.community')
  const [capability] = model.capabilities

  // An unknown capability shows its API name rather than its missing translation key.
  return capability
    ? `${standing} · ${t(`capabilities.${capability}`, { defaultValue: capability })}`
    : standing
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
