import { useTranslation } from 'react-i18next'
import { assistantAction, refusalKey } from '@shared/domain/assistant'
import type { AssistantStep } from '../conversation'

/**
 * What an action answered, as a COUNT where there is one to give.
 *
 * A count and not the values: the thread is a conversation, not a console, and a list of forty
 * paths under a line reads as a dump. What the model needs of it is in the history instead.
 */
function answerOf(data: unknown): { count: number } {
  return { count: Array.isArray(data) ? data.length : 1 }
}

export function AssistantConversationStep({ step }: { step: AssistantStep }) {
  const { t } = useTranslation()
  const action = assistantAction(step.action)
  // An action the registry no longer declares cannot reach here — the executor checks first —
  // but a thread rendered from a turn kept across a reload could, and a blank line says nothing.
  const title = action ? t(action.titleKey) : step.action

  if (step.refusal === null) {
    return (
      <p className="text-muted text-mini m-0 px-2">
        {step.data === undefined
          ? title
          : `${title} — ${t('assistant.stepAnswered', answerOf(step.data))}`}
      </p>
    )
  }

  return (
    <p className="text-warning text-mini m-0 px-2">
      {t('assistant.refused', { action: title, reason: t(refusalKey(step.refusal)) })}
    </p>
  )
}
