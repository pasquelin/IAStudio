import { mdiCreationOutline, mdiEyedropperVariant, mdiTranslate } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PromptStyle, PromptSuggestion, PromptTranslation } from '@shared/domain/prompt-assist'
import { cn } from '@/helpers/cn'
import { Button } from './Button'
import { ToolButton } from './ToolButton'
import { HINT_TOP, TIP_BOTTOM } from '@/helpers/tooltip'

export type PromptAssistantProps = {
  /** Reads the draft at the moment it is asked for — never during a render. */
  readDraft: () => string
  request: (draft: string) => Promise<PromptSuggestion[]>
  translate: (draft: string) => Promise<PromptTranslation>
  /** Reads the style of the reference pictures the form carries. */
  describeStyle: (images: readonly string[]) => Promise<PromptStyle>
  /** The references sitting on the form, read at the moment they are needed. */
  readReferences: () => string[]
  /** Adopts the text alone, leaving every other field as the user set it. */
  onAdoptText: (text: string) => void
  /** Adopts the text and the settings that came with it. */
  onAdoptCall: (suggestion: PromptSuggestion) => void
  /** Translated message of a refused request, from `failureKeyOf`. */
  failureMessage: (error: unknown) => string
}

/** What the API answers with when the draft was already in the language the models read. */
const ENGLISH = 'english'

/**
 * The prompt assistance that sits under the field the model marks as its prompt: rewriting into
 * variants, and carrying a draft into the language the models are trained in.
 *
 * Two adoptions rather than one: the settings are worth having, but overwriting a ratio the
 * user has just chosen — without being asked — is not something a suggestion gets to do.
 */
export function PromptAssistant({
  readDraft,
  request,
  translate,
  describeStyle,
  readReferences,
  onAdoptText,
  onAdoptCall,
  failureMessage,
}: PromptAssistantProps) {
  const { t } = useTranslation()
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([])
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  /** The waiting, the clearing and the failure handling all three actions share. */
  const perform = (action: () => Promise<void>): void => {
    setPending(true)
    // Cleared as the request goes out rather than when it comes back: what is on screen belongs
    // to the previous answer, and leaving it there through a refusal would attribute it to this.
    setFailure(null)
    setSuggestions([])

    void action()
      .catch((error: unknown) => setFailure(failureMessage(error)))
      .finally(() => setPending(false))
  }

  const ask = (): void =>
    perform(async () => {
      const answer = await request(readDraft())
      setSuggestions(answer)
      // An answer with nothing in it is not a failure, and must not read as one.
      if (answer.length === 0) setFailure(t('prompt.noSuggestion'))
    })

  const carryOver = (): void => {
    const draft = readDraft()
    // Nothing to carry, and the channel refuses blank text anyway.
    if (draft.trim() === '') return

    perform(async () => {
      const { text, detectedLanguage } = await translate(draft)

      // Already on the right side: replacing the text would rewrite what the user wrote for no
      // gain, so it is left alone and said so.
      if (detectedLanguage.toLowerCase() === ENGLISH) setFailure(t('prompt.alreadyEnglish'))
      else onAdoptText(text)
    })
  }

  const readStyle = (): void => {
    const references = readReferences()
    // Nothing shown means nothing to read, and the channel refuses an empty list anyway.
    if (references.length === 0) {
      setFailure(t('prompt.noReference'))
      return
    }

    perform(async () => onAdoptText((await describeStyle(references)).description))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        <ToolButton
          icon={mdiEyedropperVariant}
          label={t('prompt.describeStyle')}
          tooltip={TIP_BOTTOM}
          variant="header"
          disabled={pending}
          onClick={readStyle}
        />
        <ToolButton
          icon={mdiTranslate}
          label={t('prompt.translate')}
          tooltip={TIP_BOTTOM}
          variant="header"
          disabled={pending}
          onClick={carryOver}
        />
        <ToolButton
          icon={mdiCreationOutline}
          label={t('prompt.suggest')}
          tooltip={TIP_BOTTOM}
          variant="header"
          disabled={pending}
          onClick={ask}
        />
      </div>

      {pending && <p className="text-muted text-tiny">{t('prompt.suggesting')}</p>}

      {failure !== null && !pending && (
        <p role="status" className="text-muted text-tiny">
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
    <div className={cn('border-border bg-surface flex flex-col gap-2 border p-1.5')}>
      <p className="text-text text-tiny leading-snug">{suggestion.text}</p>

      {suggestion.rationale && (
        <p className="text-muted text-tiny italic">{suggestion.rationale}</p>
      )}

      {settings.length > 0 && (
        <p className="text-muted text-tiny">
          {settings.map(([key, value]) => `${key} ${String(value)}`).join(' · ')}
        </p>
      )}

      <div className="flex gap-2">
        <Button {...HINT_TOP(t('prompt.useTextHint'))} onClick={onAdoptText}>
          {t('prompt.useText')}
        </Button>
        {settings.length > 0 && (
          <Button {...HINT_TOP(t('prompt.useTextAndSettingsHint'))} onClick={onAdoptCall}>
            {t('prompt.useTextAndSettings')}
          </Button>
        )}
      </div>
    </div>
  )
}
