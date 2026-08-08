import { mdiCreationOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PromptSuggestion } from '@shared/domain/prompt-assist'
import { cn } from '@/helpers/cn'
import { Button } from './Button'
import { ToolButton } from './ToolButton'

export type PromptSuggestionsProps = {
  /** Reads the draft at the moment it is asked for — never during a render. */
  readDraft: () => string
  request: (draft: string) => Promise<PromptSuggestion[]>
  /** Adopts the text alone, leaving every other field as the user set it. */
  onAdoptText: (text: string) => void
  /** Adopts the text and the settings that came with it. */
  onAdoptCall: (suggestion: PromptSuggestion) => void
  /** Translated message of a refused request, from `failureKeyOf`. */
  failureMessage: (error: unknown) => string
}

/**
 * The prompt assistance that sits under the field the model marks as its prompt.
 *
 * Two adoptions rather than one: the settings are worth having, but overwriting a ratio the
 * user has just chosen — without being asked — is not something a suggestion gets to do.
 */
export function PromptSuggestions({
  readDraft,
  request,
  onAdoptText,
  onAdoptCall,
  failureMessage,
}: PromptSuggestionsProps) {
  const { t } = useTranslation()
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([])
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const ask = (): void => {
    setPending(true)
    setFailure(null)

    void request(readDraft())
      .then(answer => {
        setSuggestions(answer)
        // An answer with nothing in it is not a failure, and must not read as one.
        setFailure(answer.length === 0 ? t('prompt.noSuggestion') : null)
      })
      .catch((error: unknown) => {
        setSuggestions([])
        setFailure(failureMessage(error))
      })
      .finally(() => setPending(false))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end">
        <ToolButton
          icon={mdiCreationOutline}
          label={t('prompt.suggest')}
          variant="header"
          disabled={pending}
          onClick={ask}
        />
      </div>

      {pending && <p className="text-muted text-[11px]">{t('prompt.suggesting')}</p>}

      {failure !== null && !pending && (
        <p role="status" className="text-muted text-[11px]">
          {failure}
        </p>
      )}

      {!pending &&
        suggestions.map((suggestion, index) => (
          <Suggestion
            key={`${index}-${suggestion.text.slice(0, 24)}`}
            suggestion={suggestion}
            onAdoptText={() => onAdoptText(suggestion.text)}
            onAdoptCall={() => onAdoptCall(suggestion)}
          />
        ))}
    </div>
  )
}

function Suggestion({
  suggestion,
  onAdoptText,
  onAdoptCall,
}: {
  suggestion: PromptSuggestion
  onAdoptText: () => void
  onAdoptCall: () => void
}) {
  const { t } = useTranslation()
  const settings = Object.entries(suggestion.parameters).filter(([key]) => key !== 'prompt')

  return (
    <div className={cn('border-border bg-surface flex flex-col gap-1 border p-1.5')}>
      <p className="text-text text-[11px] leading-snug">{suggestion.text}</p>

      {suggestion.rationale && (
        <p className="text-muted text-[11px] italic">{suggestion.rationale}</p>
      )}

      {settings.length > 0 && (
        <p className="text-muted text-[11px]">
          {settings.map(([key, value]) => `${key} ${String(value)}`).join(' · ')}
        </p>
      )}

      <div className="flex gap-1">
        <Button onClick={onAdoptText}>{t('prompt.useText')}</Button>
        {settings.length > 0 && (
          <Button onClick={onAdoptCall}>{t('prompt.useTextAndSettings')}</Button>
        )}
      </div>
    </div>
  )
}
