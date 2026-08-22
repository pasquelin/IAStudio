import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelCandidate } from '@shared/domain/aiOverview'
import type { AiRoleId } from '@shared/domain/aiRole'
import { modelThumbnailUrl, type DownloadProgress } from '@shared/domain/localModel'
import { Thumbnail } from '@/design/Thumbnail'
import { useBytes } from '@/hooks/useBytes'
import type { ModelFitSentence } from '@/hooks/useModelFit'
import { AiChoiceRow } from './AiChoiceRow'
import { AiModelActions } from './AiModelActions'

export type AiCandidateRowProps = {
  role: AiRoleId
  candidate: ModelCandidate
  chosen: boolean
  fit: ModelFitSentence
  /** The download in flight, when it is this model's. */
  progress: DownloadProgress | null
  /** How far this model's load has got, from 0 to 1 — `null` when it is not the one loading. */
  loading: number | null
  /** Whether some install already holds the disk — a second would compete with it. */
  busy: boolean
  onChoose: () => void
}

/**
 * One model a role could run on, with the machine's verdict. Shown even when it cannot run: a
 * model too heavy stays visible and greyed, with its figure, rather than vanishing from the list.
 */
export const AiCandidateRow = memo(function AiCandidateRow({
  role,
  candidate,
  chosen,
  fit,
  progress,
  loading,
  busy,
  onChoose,
}: AiCandidateRowProps) {
  const { t } = useTranslation()
  const bytes = useBytes()

  return (
    <AiChoiceRow
      role={role}
      choice={candidate.model.id}
      // Data, not a word of the interface: a model is called what its publisher calls it.
      label={candidate.model.name}
      caption={`${bytes(candidate.model.diskBytes)} · ${fit.verdict}`}
      // The provenance comes FIRST when there is one to say: it qualifies everything after it.
      hint={
        candidate.unverified
          ? [t('aiModels.unverifiedProvenance'), fit.note].filter(part => part).join(' · ')
          : fit.note
      }
      checked={chosen}
      disabled={!fit.usable}
      onChoose={onChoose}
      picture={<Thumbnail url={modelThumbnailUrl(candidate.model)} className="size-8" />}
    >
      <AiModelActions candidate={candidate} progress={progress} loading={loading} busy={busy} />
    </AiChoiceRow>
  )
})
