import { useTranslation } from 'react-i18next'
import { assistantAction, confirmKey } from '@shared/domain/assistant'
import { clipped } from '@shared/text'
import { Button } from '@/design/Button'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAssistant } from '@/stores/assistant'
import { formatList, formatUnits } from '@/helpers/format'
import type { ConfirmRequest } from '../confirm'
import { CONVERSATION_CARD } from './conversationStyles'

/**
 * The yes-or-no, with what it engages stated first.
 *
 * A figure is quoted only when there is one: an upload has no price, and `null` means the API
 * declined to give one — said as such rather than filled in with a guess.
 */
/** 🛑 Bounded: a prompt is a paragraph, and a card the height of the thread hides its buttons. */
const VALUE_MAX = 160

export function AssistantConversationQuestion({ request }: { request: ConfirmRequest }) {
  const { t, i18n } = useTranslation()
  const action = assistantAction(request.action)
  const answer = useAssistant(state => state.answer)

  /**
   * One value as a PERSON reads it, by the field's own kind — this is the only surface where
   * somebody rereads what they are approving, and `JSON.stringify` renders a list as brackets
   * and a boolean as `true`.
   */
  const valueShown = (value: unknown): string => {
    if (typeof value === 'boolean')
      return t(value ? 'assistant.confirm.on' : 'assistant.confirm.off')

    // Clipped on EVERY path: `assets.remove` takes a repeated field, and two hundred ids joined
    // by « et » is a card taller than the thread, with Allow and Refuse off the bottom of it.
    const written = Array.isArray(value)
      ? formatList(value.map(String), i18n.language, 'conjunction')
      : typeof value === 'string'
        ? value
        : (JSON.stringify(value) ?? '')

    return clipped(written, VALUE_MAX)
  }

  /**
   * Keyed off the commitment rather than branched on it, so a fifth level cannot fall silently
   * into the wrong sentence — which a chain of `if` ending on credits would let it do.
   */
  const reason = (): string => {
    if (request.commitment !== 'credits') return t(confirmKey(request.commitment))
    if (typeof request.estimate !== 'number') return t('assistant.confirm.unknownCost')

    return t('assistant.confirm.credits', {
      cost: t('generation.estimatedCost', {
        units: formatUnits(request.estimate, i18n.language),
      }),
    })
  }

  return (
    <div className={CONVERSATION_CARD}>
      <p className="text-text m-0 text-xs font-medium">
        {action ? t(action.titleKey) : request.action}
      </p>

      {/* 🛑 What it was called WITH — the half that was missing. See `ConfirmRequest.input`. */}
      {(action?.fields ?? []).map(field =>
        request.input[field.key] === undefined ? null : (
          <p key={field.key} className="text-text text-mini m-0">
            {t('assistant.confirm.value', {
              label: t(field.labelKey),
              value: valueShown(request.input[field.key]),
            })}
          </p>
        ),
      )}

      <p className="text-muted text-mini m-0">{reason()}</p>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={() => answer(true)}
          {...HINT_TOP(t('assistant.confirm.yesHint'))}
        >
          {t('assistant.confirm.yes')}
        </Button>
        <Button onClick={() => answer(false)} {...HINT_TOP(t('assistant.confirm.noHint'))}>
          {t('assistant.confirm.no')}
        </Button>
      </div>
    </div>
  )
}
