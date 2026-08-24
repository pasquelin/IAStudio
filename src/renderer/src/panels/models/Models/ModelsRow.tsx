import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import { Thumbnail } from '@/design/Thumbnail'
import { ROW_THUMBNAIL } from '@/design/styles'
import { Row } from '@/design/Row'
import { modelSubtitle } from './modelSubtitle'

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
      media={<Thumbnail url={picture} className={ROW_THUMBNAIL} />}
      title={model.name}
      // The subtitle says what the model IS; the refusal says why it is out of reach, and it
      // replaces the standing rather than crowding a 10px line with both.
      subtitle={refusal ? refusal.word : modelSubtitle(model, t)}
      hint={refusal?.hint}
    />
  )
})
