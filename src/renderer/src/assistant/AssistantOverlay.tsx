import { mdiClose } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ASSISTANT_MODELS,
  assistantAction,
  type AssistantModel,
  refusalKey,
} from '@shared/domain/assistant'
import { Button } from '@/design/Button'
import { QuietNote } from '@/design/QuietNote'
import { Spinner } from '@/design/Spinner'
import { ToolButton } from '@/design/ToolButton'
import { CONTROL, FIELD } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP, TIP_BOTTOM, TIP_LEFT } from '@/helpers/tooltip'
import { useDismiss } from '@/hooks/useDismiss'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { formatUnits } from '@/usage/format'
import { registerDictationTarget } from '@/dictation/destination'
import type { ConfirmRequest } from './confirm'
import { registerConfirmer } from './confirm'
import type { AssistantStep, AssistantTurn } from './conversation'

/**
 * The assistant, as a modal over the whole window.
 *
 * Mounted once by the shell rather than by a panel, for two reasons that both come down to the
 * same thing: it is the studio one talks to, not a dock — and it is where a question gets asked
 * before anything is spent, including a question raised from outside this window. A panel that
 * happened to be closed would mean no one could be asked.
 *
 * Deliberately plain. What it has to carry beyond a field and a thread is what holds a decision
 * rather than a look: the running total, the yes-or-no, and the model picker — which lives here
 * and not in the settings because the moment one wants a better model is the middle of a
 * sentence.
 */
export function AssistantOverlay() {
  const { t, i18n } = useTranslation()
  const open = useAssistant(state => state.open)
  const turns = useAssistant(state => state.turns)
  const busy = useAssistant(state => state.busy)
  const asked = useAssistant(state => state.asked)
  const spent = useAssistant(state => state.spent)
  const hide = useAssistant(state => state.hide)
  const model = useSettings(state => state.settings.assistant.model)

  const surface = useRef<HTMLDivElement>(null)
  const thread = useRef<HTMLOListElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  // For as long as the shell is up, and only from here: a confirmation shown where nobody is
  // looking is not a confirmation.
  useEffect(() => registerConfirmer(useAssistant.getState().ask), [])

  // A question is answered, never walked away from: Escape and a press outside would otherwise
  // leave the action that raised it waiting for an answer that can no longer come.
  useDismiss(open && !asked ? hide : undefined, surface)

  /**
   * The spoken word, while the modal is up.
   *
   * Claimed from here rather than branched on inside the dictation session, which knows nothing
   * about this modal. Being OPEN is the test, and not a caret inside it: one dictates with the
   * hands off the keyboard, so asking for a focused field would make the voice path unreachable
   * by voice.
   */
  useEffect(() => {
    if (!open) return
    return registerDictationTarget(text => void useAssistant.getState().say(text))
  }, [open])

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  useEffect(() => {
    const list = thread.current
    if (list) list.scrollTop = list.scrollHeight
  }, [turns])

  if (!open) return null

  const send = (): void => {
    void useAssistant.getState().say(draft)
    setDraft('')
  }

  return (
    <div className="bg-scrim fixed inset-0 z-50 flex items-start justify-center p-8">
      <div
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-label={t('assistant.title')}
        className={cn(
          'border-border bg-panel flex max-h-full w-full max-w-2xl flex-col gap-2',
          'rounded-(--radius-sc-lg) border p-2 shadow-(--sc-shadow-floating)',
        )}
      >
        <header className="flex shrink-0 items-center gap-2">
          <h2 className="text-text m-0 flex-1 truncate text-xs font-medium">
            {t('assistant.title')}
          </h2>

          <output className="text-muted text-mini tabular-nums">
            {t('units.creative', { units: formatUnits(spent, i18n.language) })}
          </output>

          <select
            {...TIP_BOTTOM(t('assistant.model'), false, t('assistant.modelHint'))}
            value={model}
            onChange={event => useAssistant.getState().setModel(asModel(event.target.value))}
            className={cn(CONTROL, 'max-w-44 px-1')}
          >
            {ASSISTANT_MODELS.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <ToolButton
            icon={mdiClose}
            label={t('assistant.close')}
            description={t('assistant.closeHint')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={hide}
          />
        </header>

        <ol
          ref={thread}
          className="m-0 flex min-h-0 flex-1 list-none flex-col gap-3 overflow-y-auto p-0"
        >
          {turns.length === 0 && (
            <li>
              <QuietNote>{t('assistant.empty')}</QuietNote>
            </li>
          )}
          {turns.map(turn => (
            <Turn key={turn.id} turn={turn} />
          ))}
        </ol>

        {busy && !asked && (
          <Spinner label={t('assistant.thinking')} size={16} className="text-muted shrink-0" />
        )}

        {asked && <Question request={asked.request} />}

        <Heard />

        <form
          className="flex shrink-0 items-center gap-2"
          onSubmit={event => {
            event.preventDefault()
            send()
          }}
        >
          <input
            ref={field}
            type="text"
            value={draft}
            placeholder={t('assistant.placeholder')}
            // While a plan is running: a second sentence would interleave two plans over one
            // generator form, and the question on screen belongs to the first of them.
            disabled={busy}
            onChange={event => setDraft(event.target.value)}
            className={cn(FIELD, 'min-w-0 flex-1 text-xs')}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || draft.trim() === ''}
            {...HINT_TOP(t('assistant.sendHint'))}
          >
            {t('assistant.send')}
          </Button>
        </form>
      </div>
    </div>
  )
}

/**
 * The one cast in the file, and why it is safe: the `<option>` list is built from
 * `ASSISTANT_MODELS`, so the only values this element can produce are the ones the union holds.
 */
function asModel(value: string): AssistantModel {
  return value as AssistantModel
}

/**
 * The sentence still being spoken, shown as the fields show it: a hypothesis, replaced by the
 * next one, and never something one could mistake for what was sent.
 *
 * A component of its own, and that is the whole reason it exists: the hypothesis is replaced
 * several times a second, and subscribing to it from the modal's own body would re-render the
 * entire thread — every turn, every step — at the speed of speech.
 */
function Heard() {
  const heard = useDictation(state => state.partial)
  if (heard === '') return null

  return <p className="text-muted m-0 shrink-0 px-2 text-xs italic">{heard}</p>
}

/** One exchange: what was asked, what came back, and what each action actually did. */
function Turn({ turn }: { turn: AssistantTurn }) {
  const { t } = useTranslation()

  return (
    <li className="flex flex-col gap-2">
      <p className="bg-surface text-text m-0 rounded-(--radius-sc-md) px-2 py-1 text-xs">
        {turn.said}
      </p>

      {turn.answered !== '' && <p className="text-text m-0 px-2 text-xs">{turn.answered}</p>}

      {turn.steps.map((step, index) => (
        // Keyed by position: the same action can legitimately run twice in one plan, and the
        // list only ever grows to the end.
        <Step key={index} step={step} />
      ))}

      {turn.lost && <p className="text-warning text-mini m-0 px-2">{t('assistant.lost')}</p>}
    </li>
  )
}

function Step({ step }: { step: AssistantStep }) {
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

/**
 * The yes-or-no, with what it engages stated first.
 *
 * A figure is quoted only when there is one: an upload has no price, and `null` means the API
 * declined to give one — said as such rather than filled in with a guess.
 */
function Question({ request }: { request: ConfirmRequest }) {
  const { t, i18n } = useTranslation()
  const action = assistantAction(request.action)
  const answer = useAssistant(state => state.answer)

  const reason = (): string => {
    if (request.commitment === 'asset') return t('assistant.confirm.asset')
    if (typeof request.estimate !== 'number') return t('assistant.confirm.unknownCost')

    return t('assistant.confirm.credits', {
      cost: t('generation.estimatedCost', {
        units: formatUnits(request.estimate, i18n.language),
      }),
    })
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex shrink-0 flex-col gap-2',
        'rounded-(--radius-sc-md) border p-2',
      )}
    >
      <p className="text-text m-0 text-xs font-medium">
        {action ? t(action.titleKey) : request.action}
      </p>
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
