import { useTranslation } from 'react-i18next'
import type { AssistantWindow } from '@shared/domain/assistant'
import { ProgressBar } from '@/design/ProgressBar'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAssistant } from '@/stores/assistant'

/**
 * The door's own word, and the frames of a turn for a door that was never asked.
 *
 * 🛑 A door that answered `null` names NO window, and its answer stands: replying on the count a
 * PREVIOUS door left is how `2 067 / 4 096` was once shown for DeepSeek.
 */
function windowShown(
  door: AssistantWindow | null | undefined,
  windowTokens: number,
): AssistantWindow | undefined {
  if (door !== undefined) return door ?? undefined
  return windowTokens > 0 ? { size: windowTokens, unit: 'tokens', assumed: false } : undefined
}

/**
 * What the door in front is bounded by, and what the last exchange spent against it — beside the
 * field it measures, and BEFORE a word is typed.
 */
export function AssistantConversationGauge() {
  const { t } = useTranslation()
  const promptTokens = useAssistant(state => state.promptTokens)
  const promptChars = useAssistant(state => state.promptChars)
  const windowTokens = useAssistant(state => state.windowTokens)
  const door = useAssistant(state => state.door)

  const shown = windowShown(door, windowTokens)

  // Nothing at all until a door has been asked: an empty zone says less than a wrong figure.
  if (shown === undefined && door !== null) return null

  // 🛑 A DECLARED fallback is not a window, and painting a gauge against one would show a made-up
  // denominator as a measurement — the very defect this lot exists to remove.
  if (shown === undefined || shown.assumed) {
    return (
      <span
        className="text-muted text-tiny"
        {...HINT_TOP(
          shown?.assumed === true
            ? t('assistant.contextHintAssumed')
            : t('assistant.contextHintUnknown'),
        )}
      >
        {promptTokens > 0
          ? t('assistant.contextUnknown', { read: promptTokens })
          : t('assistant.contextNoWindow')}
      </span>
    )
  }

  // Characters against a character bound, tokens against a token one — never the two mixed.
  const byLength = shown.unit === 'characters'
  const read = byLength ? promptChars : promptTokens

  return (
    <span
      className="flex items-center gap-2"
      {...HINT_TOP(byLength ? t('assistant.contextHintChars') : t('assistant.contextHint'))}
    >
      <span className="text-muted text-tiny">
        {byLength
          ? t('assistant.contextOfChars', { read, window: shown.size })
          : t('assistant.contextOf', { read, window: shown.size })}
      </span>
      <ProgressBar ratio={read / shown.size} label={t('assistant.contextGauge')} className="w-12" />
    </span>
  )
}
