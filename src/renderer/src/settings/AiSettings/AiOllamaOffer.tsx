import { mdiInformationOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { OllamaOffer } from '@shared/domain/aiOverview'
import { UiIcon } from '@/design/UiIcon'
import { WINDOW_HELP } from '@/design/windowStyles'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useAiModels } from '@/stores/aiModels'
import { AiFlightRow } from './AiFlightRow'

function ollamaHelpKey(offer: OllamaOffer): string {
  if (offer.failed) return 'aiModels.ollamaHelpFailed'
  if (!offer.installed && !offer.ready) return 'aiModels.ollamaHelpMissing'
  if (!offer.ready) return 'aiModels.ollamaHelpDown'
  if (offer.names.length === 0) return 'aiModels.ollamaHelpEmpty'
  return 'aiModels.ollamaHelpElsewhere'
}

function needsInstall(offer: OllamaOffer): boolean {
  return !offer.installed && !offer.ready
}

export type AiOllamaOfferProps = {
  offer: OllamaOffer
  /** Whether some other install already holds the disk. */
  busy: boolean
}

/** Why this employment has no Ollama model, and the button that puts Ollama on this computer. */
export function AiOllamaOffer({ offer, busy }: AiOllamaOfferProps) {
  const { t } = useTranslation()
  const installOllama = useAiModels(state => state.installOllama)
  const cancelInstallOllama = useAiModels(state => state.cancelInstallOllama)
  const line = t(ollamaHelpKey(offer))

  if (offer.progress !== null) {
    return (
      <li className="py-2">
        <AiFlightRow
          ratio={offer.progress}
          label={t('aiModels.installingOllama')}
          stop={t('aiModels.cancelInstall')}
          stopHint={t('aiModels.cancelInstallHint')}
          onStop={() => void cancelInstallOllama()}
        />
      </li>
    )
  }

  if (needsInstall(offer) || offer.failed) {
    return (
      <li className="flex flex-col items-start gap-2 py-2">
        <span className="alert alert-info alert-soft">
          <UiIcon path={mdiInformationOutline} />
          {line}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          {...HINT_LEFT(t('aiModels.installOllamaHint'))}
          onClick={() => void installOllama()}
        >
          {t('aiModels.installOllama')}
        </button>
      </li>
    )
  }

  return (
    <li className="py-2">
      <p className={WINDOW_HELP}>{line}</p>
    </li>
  )
}
