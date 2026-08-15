import { mdiMicrophone } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { STT_MODEL_BYTES } from '@shared/domain/dictation'
import { ProgressBar } from '@/design/ProgressBar'
import { STATUS_BUTTON } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { formatBytes } from '@/helpers/format'
import { assistantHearsSpeech, useAssistant } from '@/stores/assistant'
import { Heard } from './Heard'
import { LevelMeter } from './LevelMeter'
import { useDictation } from './useDictation'
import { HINT_TOP } from '@/helpers/tooltip'

/**
 * What dictation has to say to the whole application, rather than to one field.
 *
 * The status line, like the update waiting to be installed beside it: the model to fetch, the
 * download running, the microphone the system refused. A form with two long text fields would
 * otherwise offer two buttons to download the same 640 MB, and a refusal repeated per field
 * says nothing more than a refusal said once.
 *
 * It also says the microphone is on, which an application that records has to: the button that
 * started the session may be behind a panel, in another workspace, or scrolled past.
 */
export function DictationStatus() {
  const { t, i18n } = useTranslation()
  const dictation = useDictation()

  if (!dictation.enabled) return null

  if (dictation.isListening) return <Listening />

  if (dictation.state === 'modelMissing') {
    const size = formatBytes(STT_MODEL_BYTES, unit => t(`units.${unit}`), i18n.language)
    return (
      <button
        type="button"
        {...HINT_TOP(t('dictation.downloadHint'))}
        onClick={() => void dictation.downloadModel()}
        className={STATUS_BUTTON}
      >
        <UiIcon path={mdiMicrophone} size={12} />
        <span>{t('dictation.download', { size })}</span>
      </button>
    )
  }

  if (dictation.state === 'downloadingModel' && dictation.download) {
    const bytes = (value: number) => formatBytes(value, unit => t(`units.${unit}`), i18n.language)
    const label = t('dictation.downloading', {
      done: bytes(dictation.download.received),
      total: bytes(dictation.download.total),
    })

    return (
      <span className="flex items-center gap-1.5">
        <span>{label}</span>
        <ProgressBar
          ratio={
            dictation.download.total > 0
              ? dictation.download.received / dictation.download.total
              : 0
          }
          label={label}
          className="w-12"
        />
        <button
          type="button"
          {...HINT_TOP(t('dictation.cancelDownloadHint'))}
          onClick={() => void dictation.cancelDownload()}
          className="hover:text-text"
        >
          {t('dictation.cancelDownload')}
        </button>
      </span>
    )
  }

  if (dictation.state === 'permissionRequired') {
    return (
      // No `role="status"`: it would replace the implicit `button` role, and this is the only
      // way out of a refused microphone — a screen reader has to find it among the buttons.
      <button
        type="button"
        {...HINT_TOP(t('dictation.openPrivacySettingsHint'))}
        onClick={() => void dictation.openPrivacySettings()}
        className={STATUS_BUTTON}
      >
        <UiIcon path={mdiMicrophone} size={12} />
        <span>{t('dictation.openPrivacySettings')}</span>
      </button>
    )
  }

  // The detail is never shown: it names a file path or an ONNX symbol, and it is in the journal.
  if (dictation.state === 'error' && dictation.failure) {
    return <span role="status">{t(`dictation.errors.${dictation.failure.code}`)}</span>
  }

  return null
}

/**
 * A live microphone, and WHERE the words are going.
 *
 * Saying only that it is on is half an answer: the same microphone types into a prompt and talks
 * to the assistant, and the two are told apart nowhere else on screen — the assistant claims the
 * spoken word without necessarily showing its window.
 *
 * It is also the only thing left visible once that window IS up: the conversation lays the studio's
 * own panel colour over everything at 80%, plus a blur, so the title bar and its entry are sunk
 * behind it. The status line never is.
 */
function Listening() {
  const { t } = useTranslation()
  const toAssistant = useAssistant(assistantHearsSpeech)

  return (
    <span className="text-accent-ink flex items-center gap-1.5">
      <span role="status" className="flex items-center gap-1.5">
        <UiIcon path={mdiMicrophone} size={12} />
        {toAssistant ? t('assistant.listening') : t('dictation.active')}
      </span>
      <LevelMeter />
      {/* Capped and truncated: the line has no width to give — four other indicators share its
          end, and a spoken sentence has no length limit. */}
      <Heard className="max-w-64 truncate" />
    </span>
  )
}
