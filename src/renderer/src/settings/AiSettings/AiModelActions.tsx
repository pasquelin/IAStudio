import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelCandidate } from '@shared/domain/aiOverview'
import type { DownloadProgress } from '@shared/domain/localModel'
import { taskRatio } from '@shared/domain/taskProgress'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useBytes } from '@/hooks/useBytes'
import { useAiModels } from '@/stores/aiModels'
import { AiFlightRow } from './AiFlightRow'

export type AiModelActionsProps = {
  candidate: ModelCandidate
  /** The download in flight, when it is this model's. */
  progress: DownloadProgress | null
  /** How far this model's load has got, from 0 to 1 — `null` when it is not the one loading. */
  loading: number | null
  /** Whether some install already holds the disk — a second would compete with it. */
  busy: boolean
}

/**
 * What can be DONE to one model: fetch it, drop it, hold it in memory, let it go.
 *
 * Two pairs and not one: installing is about the disk, loading is about the memory, and "activate"
 * has always meant the second — ADR-21 § D. A model can be installed and idle, which is the state
 * a machine spends most of its time in.
 */
export const AiModelActions = memo(function AiModelActions({
  candidate,
  progress,
  loading,
  busy,
}: AiModelActionsProps) {
  const { t } = useTranslation()
  const bytes = useBytes()
  const installAiModel = useAiModels(state => state.installAiModel)
  const cancelAiInstall = useAiModels(state => state.cancelAiInstall)
  const removeAiModel = useAiModels(state => state.removeAiModel)
  const loadAiModel = useAiModels(state => state.loadAiModel)
  const cancelAiLoad = useAiModels(state => state.cancelAiLoad)
  const unloadAiModel = useAiModels(state => state.unloadAiModel)

  if (progress) {
    return (
      <AiFlightRow
        ratio={taskRatio(progress.received, progress.total)}
        label={t('aiModels.installing')}
        stop={t('aiModels.cancelInstall')}
        stopHint={t('aiModels.cancelInstallHint')}
        onStop={() => void cancelAiInstall()}
      />
    )
  }

  if (loading !== null) {
    return (
      <AiFlightRow
        ratio={loading}
        label={t('aiModels.loading')}
        stop={t('aiModels.cancelLoad')}
        stopHint={t('aiModels.cancelLoadHint')}
        onStop={() => void cancelAiLoad()}
      />
    )
  }

  if (!candidate.installed) {
    return (
      // Offered whatever the machine thinks of it: hiding the button decided for the person, and
      // a download that will not fit says so when it fails rather than never being offered.
      <button
        type="button"
        {...HINT_LEFT(t('aiModels.installHint', { size: bytes(candidate.model.diskBytes) }))}
        className="btn btn-sm"
        disabled={busy}
        onClick={() => void installAiModel(candidate.model.id)}
      >
        {t('aiModels.install')}
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      {/* Offered only where the runtime can actually hold weights: a runtime that opens its own
          per call answered a memory sentence about a gesture that does not exist. */}
      {candidate.holdable && (
        <button
          type="button"
          {...HINT_LEFT(candidate.loaded ? t('aiModels.unloadHint') : t('aiModels.loadHint'))}
          className="btn btn-sm"
          onClick={() =>
            void (candidate.loaded
              ? unloadAiModel(candidate.model.id)
              : loadAiModel(candidate.model.id))
          }
        >
          {candidate.loaded ? t('aiModels.unload') : t('aiModels.load')}
        </button>
      )}

      <button
        type="button"
        // The WORD follows the EFFECT, both off `supplied`: their file stays where they put it,
        // and the studio only ever drops the entry that pointed at it.
        {...HINT_LEFT(candidate.supplied ? t('aiModels.forgetHint') : t('aiModels.removeHint'))}
        className="btn btn-sm"
        onClick={() => void removeAiModel(candidate.model.id)}
      >
        {candidate.supplied ? t('aiModels.forget') : t('aiModels.remove')}
      </button>
    </span>
  )
})
