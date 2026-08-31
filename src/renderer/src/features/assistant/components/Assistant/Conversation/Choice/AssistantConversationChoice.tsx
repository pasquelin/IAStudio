import { useTranslation } from 'react-i18next'
import { answeredByComposer } from '@shared/domain/assistant'
import { Button } from '@/components/Button'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAssistant, type AssistantChoiceQuestion } from '@/stores/assistant'
import { AssistantConversationChoiceForm } from './AssistantConversationChoiceForm'
import { CONVERSATION_CARD } from '../conversationStyles'

/**
 * What the assistant asked, with the answers it offered — and often none: « quel nom ? » has
 * nothing to press, so the composer below takes the answer and the card says where.
 */
export function AssistantConversationChoice({ questions }: AssistantChoiceQuestion) {
  const { t } = useTranslation()
  const choose = useAssistant(state => state.choose)
  const only = questions[0]

  // Anything the composer cannot answer is a form: a line typed below says nothing about which
  // question it belongs to.
  if (!only || !answeredByComposer(questions)) {
    return <AssistantConversationChoiceForm questions={questions} />
  }

  return (
    <div className={CONVERSATION_CARD}>
      <p className="text-text m-0 text-xs font-medium">{only.question}</p>

      {only.choices.length === 0 && (
        <p className="text-muted text-mini m-0">{t('assistant.answerBelow')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {only.choices.map(choice => (
          <Button
            key={choice}
            onClick={() => choose([{ answer: choice }])}
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
