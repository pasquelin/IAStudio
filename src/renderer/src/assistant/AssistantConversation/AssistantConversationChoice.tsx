import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAssistant, type AssistantChoiceQuestion } from '@/stores/assistant'
import { CONVERSATION_CARD } from './conversationStyles'

/**
 * What the assistant asked, with the answers it offered — and often none: « quel nom ? » has
 * nothing to press, so the composer below takes the answer and the card says where.
 */
export function AssistantConversationChoice({ question, choices }: AssistantChoiceQuestion) {
  const { t } = useTranslation()
  const choose = useAssistant(state => state.choose)

  return (
    <div className={CONVERSATION_CARD}>
      <p className="text-text m-0 text-xs font-medium">{question}</p>

      {choices.length === 0 && (
        <p className="text-muted text-mini m-0">{t('assistant.answerBelow')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {choices.map(choice => (
          <Button
            key={choice}
            onClick={() => choose(choice)}
            {...HINT_TOP(t('assistant.chooseHint'))}
          >
            {choice}
          </Button>
        ))}
        {/* Dismissing is an ANSWER, and the only one that spends nothing: the chain reads it as
            declined and stops rather than picking for the person. */}
        <Button onClick={() => choose(null)} {...HINT_TOP(t('assistant.skipChoiceHint'))}>
          {t('assistant.skipChoice')}
        </Button>
      </div>
    </div>
  )
}
