import { mdiMicrophone } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/components/UiIcon'
import { useAssistant } from '@/stores/assistant'
import { Heard } from '../Heard'
import { LevelMeter } from '../LevelMeter'

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
export function DictationStatusListening() {
  const { t } = useTranslation()
  // The CLAIM, never the host: the assistant is what an untouched right column draws, so being
  // on screen would say the words go there while they land in the prompt one is typing.
  const toAssistant = useAssistant(state => state.hearing)

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
