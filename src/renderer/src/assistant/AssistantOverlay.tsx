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
import { HINT_TOP, TIP_BOTTOM, TIP_LEFT, TIP_TOP } from '@/helpers/tooltip'
import { useDismiss } from '@/hooks/useDismiss'
import { assistantHearsSpeech, useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { formatUnits } from '@/usage/format'
import { DictationButton } from '@/dictation/DictationButton'
import { Heard } from '@/dictation/Heard'
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
  const listening = useAssistant(state => state.listening)
  const hears = useAssistant(assistantHearsSpeech)
  const micOpen = useDictation(store => store.state === 'listening')
  const model = useSettings(state => state.settings.assistant.model)

  const surface = useRef<HTMLDivElement>(null)
  const thread = useRef<HTMLOListElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')

  // For as long as the shell is up, and only from here: a confirmation shown where nobody is
  // looking is not a confirmation.
  useEffect(() => registerConfirmer(useAssistant.getState().ask), [])

  // A question is answered, never walked away from: Escape and a press outside would otherwise
  // leave the action that raised it waiting for an answer that can no longer come.
  useDismiss(open && !asked ? hide : undefined, surface)

  /**
   * The spoken word, whether or not this window is showing.
   *
   * Claimed from here rather than branched on inside the dictation session, which knows nothing
   * about this modal. Not a caret inside it either: one dictates with the hands off the keyboard,
   * so asking for a focused field would make the voice path unreachable by voice.
   *
   * **Declared before the microphone's effect below, and that is the whole ordering.** React runs
   * effects in the order they are written, so the words are claimed before anything opens a
   * stream — a sentence settling with no target goes to the caret, and that is the defect these
   * two entries exist to remove.
   */
  useEffect(() => {
    if (!hears) return

    return registerDictationTarget(text => {
      // While a plan is running the assistant takes no new sentence — but the words were spoken,
      // and dropping them left no trace at all: not sent, not inserted at the caret (the claim
      // above short-circuits that), nothing on screen. They land in the field instead, where
      // they wait exactly as typed ones do.
      if (useAssistant.getState().busy) {
        setDraft(current => (current === '' ? text : `${current} ${text}`))
        return
      }

      void useAssistant.getState().say(text)
    })
  }, [hears])

  /**
   * And the session ends with the claim, whichever button opened it.
   *
   * Its own effect rather than a line inside the cleanup above, because the two answer different
   * questions and one of them is conditional: giving the words back is unconditional, closing a
   * microphone is not — a window dismissed while nothing was being said has none to close, and
   * `stop()` would still cross to the main process on every dismissal.
   *
   * Measured on screen, not deduced: dictating from the window's own microphone leaves `listening`
   * false, so the effect below released nothing and the next sentence went to the caret with the
   * status line quietly changing to "dictating to the field".
   */
  useEffect(() => {
    if (!hears) return

    return () => {
      if (useDictation.getState().state === 'listening') void useDictation.getState().stop()
    }
  }, [hears])

  /**
   * The microphone, for the entry that talks to the studio without showing this window.
   *
   * Opened here rather than by the button, so it can only open once the effect above has claimed
   * the words. The cleanup is the other half of that: it is what closes the microphone when the
   * window is dismissed mid-sentence, since `hide` clears `listening` along with `open`.
   *
   * Nothing here when the words are dictated INTO the open window — `DictationField` below owns
   * that session, and its button is what ends it.
   */
  useEffect(() => {
    if (!listening) return

    void useDictation
      .getState()
      .start()
      // A microphone that never opened — the model still to fetch, a refused device — must not
      // leave the claim standing: every later sentence dictated into a field would come here
      // instead, and nothing on screen would explain why.
      .then(() => {
        if (useDictation.getState().state !== 'listening') {
          useAssistant.getState().stopListening()
        }
      })

    // Guarded like the one above, and for the second case it does not cover: giving the words
    // back while the window STAYS open leaves `hears` true, so nothing else would end the session.
    return () => {
      if (useDictation.getState().state === 'listening') void useDictation.getState().stop()
    }
  }, [listening])

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
            {/* Named from the bundle, never from the union: a raw `gemini-3.5-flash` in an
                otherwise French list is the defect this repository pays for most. */}
            {ASSISTANT_MODELS.map(name => (
              <option key={name} value={name}>
                {t(`assistant.models.${name}`)}
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

        {/* The running hypothesis, above the field it will land in. The label is what makes it
            this window's: it says where the words are going, which "Listening…" does not — the
            same microphone dictates into a prompt. */}
        {micOpen && <Heard label={t('assistant.listening')} className="shrink-0 px-2 text-xs" />}

        <form
          className="flex shrink-0 items-end gap-2"
          onSubmit={event => {
            event.preventDefault()
            send()
          }}
        >
          {/* A textarea rather than a line: one SPEAKS to this window, and a spoken request runs
              long — dictated into a single line it scrolled sideways under the caret, with the
              beginning of one's own sentence out of sight. */}
          <textarea
            ref={field}
            rows={2}
            value={draft}
            placeholder={t('assistant.placeholder')}
            // While a plan is running: a second sentence would interleave two plans over one
            // generator form, and the question on screen belongs to the first of them.
            disabled={busy}
            onChange={event => setDraft(event.target.value)}
            // Enter still sends, as it did when this was one line: a textarea's own default would
            // have made the keyboard path to sending disappear. Shift+Enter is the new line.
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.shiftKey) return
              event.preventDefault()
              send()
            }}
            className={cn(FIELD, 'h-auto min-w-0 flex-1 resize-none py-1 text-xs')}
          />

          {/* Beside the button it shares a job with: this pair is "how the sentence gets in",
              and the microphone hovering above the field read as belonging to the thread. */}
          <DictationButton variant="header" tooltip={TIP_TOP} />

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
