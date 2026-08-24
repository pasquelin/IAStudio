import { useTranslation } from 'react-i18next'
import { assistantAction, refusalKey } from '@shared/domain/assistant'
import type { AssistantStep } from '../conversation'

export function AssistantConversationStep({ step }: { step: AssistantStep }) {
  const { t } = useTranslation()
  const action = assistantAction(step.action)
  // An action the registry no longer declares cannot reach here — the executor checks first —
  // but a thread rendered from a turn kept across a reload could, and a blank line says nothing.
  const title = action ? t(action.titleKey) : step.action

  if (step.refusal === null) return <p className="text-muted text-mini m-0 px-2">{title}</p>

  return (
    <p className="text-warning text-mini m-0 px-2">
      {t('assistant.refused', { action: title, reason: t(refusalKey(step.refusal)) })}
    </p>
  )
}
