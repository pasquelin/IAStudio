import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelCandidate } from '@shared/domain/aiOverview'
import type { AiRoleId } from '@shared/domain/aiRole'
import { downloadBytesOf, type DownloadProgress } from '@shared/domain/localModel'
import { fitAllowsDownload } from '@shared/domain/modelFit'
import { taskRatio } from '@shared/domain/taskProgress'
import { ProgressBar } from '@/design/ProgressBar'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useBytes } from '@/hooks/useBytes'
import type { ModelFitSentence } from '@/hooks/useModelFit'
import { useAiModels } from '@/stores/aiModels'
import { AiChoiceRow } from './AiChoiceRow'

export type AiCandidateRowProps = {
  role: AiRoleId
  candidate: ModelCandidate
  chosen: boolean
  fit: ModelFitSentence
  /** The download in flight, when it is this model's. */
  progress: DownloadProgress | null
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
  busy,
  onChoose,
}: AiCandidateRowProps) {
  const { t } = useTranslation()
  const bytes = useBytes()
  const installAiModel = useAiModels(state => state.installAiModel)
  const cancelAiInstall = useAiModels(state => state.cancelAiInstall)
  const removeAiModel = useAiModels(state => state.removeAiModel)

  const size = bytes(downloadBytesOf(candidate.model))

  return (
    <AiChoiceRow
      role={role}
      choice={candidate.model.id}
      // Data, not a word of the interface: a model is called what its publisher calls it.
      label={candidate.model.name}
      caption={`${size} · ${fit.verdict}`}
      hint={fit.note}
      checked={chosen}
      disabled={!fit.usable}
      onChoose={onChoose}
    >
      {progress ? (
        <span className="flex items-center gap-2">
          <ProgressBar
            ratio={taskRatio(progress.received, progress.total)}
            label={t('aiModels.installing')}
            className="w-24"
          />
          <button
            type="button"
            {...HINT_LEFT(t('aiModels.cancelInstallHint'))}
            className="btn btn-sm"
            onClick={() => void cancelAiInstall()}
          >
            {t('aiModels.cancelInstall')}
          </button>
        </span>
      ) : candidate.installed ? (
        <button
          type="button"
          {...HINT_LEFT(t('aiModels.removeHint'))}
          className="btn btn-sm"
          onClick={() => void removeAiModel(candidate.model.id)}
        >
          {t('aiModels.remove')}
        </button>
      ) : (
        fitAllowsDownload(candidate.obstacle) && (
          <button
            type="button"
            {...HINT_LEFT(t('aiModels.installHint', { size }))}
            className="btn btn-sm"
            disabled={busy}
            onClick={() => void installAiModel(candidate.model.id)}
          >
            {t('aiModels.install')}
          </button>
        )
      )}
    </AiChoiceRow>
  )
})
