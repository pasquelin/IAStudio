import { memo } from 'react'
import type { ModelSummary } from '@shared/domain/model'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import { Thumbnail } from '@/design/Thumbnail'
import { Row } from '@/design/Row'

/** Memoized like the card: a scroll re-renders every mounted row on each frame. */
export const ModelsRow = memo(function ModelsRow({
  model,
  picture,
  subtitle,
  refusal,
}: {
  model: ModelSummary
  picture?: string
  /** Resolved by the panel, not here — see `modelSubtitle`. */
  subtitle: string
  refusal?: ModelRefusalWord
}) {
  return (
    <Row
      media={<Thumbnail url={picture} className="size-8" />}
      title={model.name}
      // The subtitle says what the model IS; the refusal says why it is out of reach, and it
      // replaces the standing rather than crowding a 10px line with both.
      subtitle={refusal ? refusal.word : subtitle}
      hint={refusal?.hint}
    />
  )
})
